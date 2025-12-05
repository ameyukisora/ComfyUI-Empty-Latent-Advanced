import torch

class EmptyLatentAdvancedSelector:
    """
    Advanced Empty Latent Selector
    """
    
    # Visual Icon + Resolution Name
    RESOLUTIONS = {
        # --- SD 1.5 Series ---
        "▯ 512×896 (9:16)": (512, 896),
        "▯ 512×768 (2:3)": (512, 768),
        "▯ 480×640 (3:4)": (480, 640),
        "□ 512×512 (1:1)": (512, 512),
        "▭ 640×480 (4:3)": (640, 480),
        "▭ 768×512 (3:2)": (768, 512),
        "▭ 896×512 (16:9)": (896, 512),
        
        # --- SDXL Series ---
        "▯ 640×1536 (SDXL - 9:21)": (640, 1536),
        "▯ 768×1344 (SDXL - 9:16)": (768, 1344),
        "▯ 832×1216 (SDXL - 2:3)": (832, 1216),
        "▯ 896×1152 (SDXL - 3:4)": (896, 1152),
        "□ 1024×1024 (SDXL - 1:1)": (1024, 1024),
        "▭ 1152×896 (SDXL - 4:3)": (1152, 896),
        "▭ 1216×832 (SDXL - 3:2)": (1216, 832),
        "▭ 1344×768 (SDXL - 16:9)": (1344, 768),
        "▭ 1536×640 (SDXL - 21:9)": (1536, 640),
        
        # --- HD/FHD Series ---
        "▯ 1080×1920 (FHD - 9:16)": (1080, 1920),
        "▯ 720×1280 (HD - 9:16)": (720, 1280),
        "▭ 1280×720 (HD - 16:9)": (1280, 720),
        "▭ 1920×1080 (FHD - 16:9)": (1920, 1080),
    }
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "Resolution": (list(cls.RESOLUTIONS.keys()), {"default": "▯ 832×1216 (SDXL - 2:3)"}),
                "Mode": (["Use Preset", "Override"], {"default": "Use Preset"}),
                
                "Ratio Lock": ("BOOLEAN", {"default": True, "label_on": "On", "label_off": "Off"}),
                
                "Width": ("INT", {"default": 832, "min": 64, "max": 16384, "step": 8}),
                "Height": ("INT", {"default": 1216, "min": 64, "max": 16384, "step": 8}),
                
                "Batch Size": ("INT", {"default": 1, "min": 1, "max": 64}),
            },
        }
    
    RETURN_TYPES = ("LATENT", "INT", "INT")
    RETURN_NAMES = ("Latent", "Width", "Height")
    FUNCTION = "generate"
    CATEGORY = "latent"
    
    # Use **kwargs 
    def generate(self, Resolution, Mode, Width, Height, **kwargs):
        ratio_lock = kwargs.get("Ratio Lock", True)
        batch_size = kwargs.get("Batch Size", 1)
        
        preset_width, preset_height = self.RESOLUTIONS[Resolution]
        
        final_width = width = 0
        final_height = height = 0

        if Mode == "Use Preset":
            final_width, final_height = preset_width, preset_height
        else:
            if ratio_lock:
                ratio = preset_width / preset_height
                final_width = self._round_to_8(Width)
                final_height = self._round_to_8(final_width / ratio)
            else:
                final_width = self._round_to_8(Width)
                final_height = self._round_to_8(Height)
        
        latent = torch.zeros([batch_size, 4, final_height // 8, final_width // 8], dtype=torch.float32, device="cpu")
        
        return ({"samples": latent}, final_width, final_height)
    
    @staticmethod
    def _round_to_8(value):
        return max(64, round(value / 8) * 8)

NODE_CLASS_MAPPINGS = {
    "EmptyLatentAdvancedSelector": EmptyLatentAdvancedSelector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EmptyLatentAdvancedSelector": "📐 Empty Latent Advanced",
}

WEB_DIRECTORY = "./js"