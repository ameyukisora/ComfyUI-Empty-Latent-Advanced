import { app } from "../../scripts/app.js";

const RESOLUTIONS = {
    // --- SD 1.5 ---
    "▯ 512×896 (9:16)": [512, 896],
    "▯ 512×768 (2:3)": [512, 768],
    "▯ 480×640 (3:4)": [480, 640],
    "□ 512×512 (1:1)": [512, 512],
    "▭ 640×480 (4:3)": [640, 480],
    "▭ 768×512 (3:2)": [768, 512],
    "▭ 896×512 (16:9)": [896, 512],
    
    // --- SDXL ---
    "▯ 640×1536 (SDXL - 9:21)": [640, 1536],
    "▯ 768×1344 (SDXL - 9:16)": [768, 1344],
    "▯ 832×1216 (SDXL - 2:3)": [832, 1216],
    "▯ 896×1152 (SDXL - 3:4)": [896, 1152],
    "□ 1024×1024 (SDXL - 1:1)": [1024, 1024],
    "▭ 1152×896 (SDXL - 4:3)": [1152, 896],
    "▭ 1216×832 (SDXL - 3:2)": [1216, 832],
    "▭ 1344×768 (SDXL - 16:9)": [1344, 768],
    "▭ 1536×640 (SDXL - 21:9)": [1536, 640],
    
    // --- HD ---
    "▯ 1080×1920 (FHD - 9:16)": [1080, 1920],
    "▯ 720×1280 (HD - 9:16)": [720, 1280],
    "▭ 1280×720 (HD - 16:9)": [1280, 720],
    "▭ 1920×1080 (FHD - 16:9)": [1920, 1080],
};

function roundTo8(value) {
    return Math.max(64, Math.round(value / 8) * 8);
}

app.registerExtension({
    name: "EmptyLatentAdvancedSelector",
    
    async nodeCreated(node) {
        if (node.comfyClass !== "EmptyLatentAdvancedSelector") return;
        
        const findWidget = (name) => node.widgets.find(w => w.name === name);

        const widgets = {
            preset: findWidget("Resolution"),
            mode: findWidget("Mode"),
            ratioLock: findWidget("Ratio Lock"),
            width: findWidget("Width"),
            height: findWidget("Height"),
            batch: findWidget("Batch Size")
        };
        
        if (!widgets.preset) return;
        
        let isUpdating = false;
        let lastChangedDimension = "Width";
        
        // --- Helpers ---

        function getAspectRatio() {
            const [w, h] = RESOLUTIONS[widgets.preset.value] || [832, 1216];
            return w / h;
        }

        function calculateDimension(changedDimension) {
            if (isUpdating || widgets.mode.value !== "Override" || !widgets.ratioLock.value) return;
            
            isUpdating = true;
            let ratio = getAspectRatio();
            
            if (changedDimension === "Width") {
                widgets.height.value = roundTo8(widgets.width.value / ratio);
            } else if (changedDimension === "Height") {
                widgets.width.value = roundTo8(widgets.height.value * ratio);
            }
            
            isUpdating = false;
        }
        
        // --- Layout & Visibility Manager ---

        function toggleWidget(widget, show) {
            if (!widget) return;
            
            if (show) {
                // Restore
                // Use 'toggle' for boolean inputs, 'number' for INT inputs
                widget.type = widget.origType || (widget.name === "Ratio Lock" ? "toggle" : "number");
                // Delete the override logic, let it compute size naturally
                delete widget.computeSize; 
            } else {
                // Hide
                if (!widget.origType) widget.origType = widget.type;
                widget.type = "HIDDEN";
                // Force height to 0 (with negative margin to collapse padding)
                widget.computeSize = () => [0, -4];
            }
        }

        function updateLayout() {
            const isOverride = widgets.mode.value === "Override";
            
            // Widgets to Hide/Show
            const targetWidgets = [widgets.ratioLock, widgets.width, widgets.height];
            
            targetWidgets.forEach(w => toggleWidget(w, isOverride));

            // 1. Calculate the new ideal size for the node
            // We use a small buffer (+4) for aesthetic spacing at the bottom
            const sz = node.computeSize();
            const newHeight = sz[1] + 4;

            // 2. Set the size. Keep width constant, update height.
            node.setSize([node.size[0], newHeight]);
            
            // 3. FORCE REDRAW (Fixes the visual "lag" or artifacts)
            // This tells the main graph engine to clear and repaint everything immediately
            app.graph.setDirtyCanvas(true, true);
        }

        function createCallback(originalCallback, handler) {
            return function(value) {
                if (originalCallback) originalCallback.call(this, value);
                if (!isUpdating) handler(value);
            };
        }
        
        // --- Callbacks ---

        widgets.preset.callback = createCallback(widgets.preset.callback, () => {
            const [w, h] = RESOLUTIONS[widgets.preset.value] || [832, 1216];
            
            // Even in Preset mode, we background update the values 
            // so if user switches to Override, the numbers start correct
            isUpdating = true;
            widgets.width.value = w;
            widgets.height.value = h; 
            isUpdating = false;
        });
        
        widgets.mode.callback = createCallback(widgets.mode.callback, () => {
            // Sync values before showing inputs to ensure data consistency
            if (widgets.mode.value === "Use Preset") {
                 const [w, h] = RESOLUTIONS[widgets.preset.value] || [832, 1216];
                 isUpdating = true;
                 widgets.width.value = w;
                 widgets.height.value = h;
                 isUpdating = false;
            } else if (widgets.mode.value === "Override") {
                // If switching to Override, ensure Ratio Logic is respected immediately
                 if(widgets.ratioLock.value) {
                    calculateDimension("Width");
                 }
            }
            // Apply visual changes
            updateLayout();
        });

        widgets.ratioLock.callback = createCallback(widgets.ratioLock.callback, () => {
            if (widgets.ratioLock.value && widgets.mode.value === "Override") {
                calculateDimension(lastChangedDimension);
            }
        });
        
        widgets.width.callback = createCallback(widgets.width.callback, () => {
            lastChangedDimension = "Width";
            calculateDimension("Width");
        });
        
        widgets.height.callback = createCallback(widgets.height.callback, () => {
            lastChangedDimension = "Height";
            calculateDimension("Height");
        });

        // --- Init ---
        // Slight delay to ensure node is attached to graph before resizing
        setTimeout(() => {
            updateLayout();
            
            // Ensure data is sync on load
            if(widgets.mode.value === "Use Preset"){
                 const [w, h] = RESOLUTIONS[widgets.preset.value] || [832, 1216];
                 widgets.width.value = w;
                 widgets.height.value = h;
            }
        }, 100);
    }
});