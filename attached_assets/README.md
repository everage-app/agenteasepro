# AgentEasePro Background Assets

## Background Image Setup

The application uses a stunning animated wave background located at:
```
C:\CODING\AgentEasePro\attached_assets\Agenteasepro_background.jpg
```

### Requirements

The background image should be:
- **Dimensions**: At least 1920x1080 pixels (Full HD) or higher for 4K displays
- **Format**: JPG or PNG
- **Style**: Navy blue with flowing gold/orange wave patterns
- **Opacity**: The image will be automatically adjusted via CSS filters (saturate, contrast, brightness)

### How It Works

The background system uses multiple layers:

1. **Base Image Layer** (`ae-bg-image`):
   - Loads the background JPG
   - Animated with slow drift movement (45s cycle)
   - Scaled to 120% and slowly pans/zooms for a living background effect

2. **Gradient Overlay** (`ae-bg-gradient`):
   - Adds depth with radial gradients
   - Darkens edges for vignette effect

3. **Blue/Cyan Wave Layer** (`ae-bg-wave`):
   - Adds shimmering blue and cyan tones
   - 35s animation cycle
   - Heavily blurred for softness

4. **Gold Accent Layer** (`ae-bg-wave-2`):
   - Orange and gold flowing accents
   - 42s counter-animation for depth
   - Enhances warmth

5. **Subtle Rotation Layer** (`ae-bg-wave-3`):
   - 60s slow rotation for shimmer
   - Very subtle, adds depth perception

6. **Vignette** (`ae-bg-vignette`):
   - Final darkening of edges
   - Focuses attention on content

### Customization

To adjust the background:

1. **Replace the image**: Drop your new image at the path above
2. **Adjust animation speed**: Edit `ae-bg-drift` keyframes in `web/src/index.css`
3. **Change overlay colors**: Modify the `ae-bg-wave` and `ae-bg-wave-2` gradients
4. **Adjust blur/brightness**: Change filters in the `.ae-bg-image` class

### Performance Notes

- The background uses CSS transforms and fixed positioning for GPU acceleration
- All layers use `pointer-events: none` to ensure clicks pass through
- Blur is optimized with `will-change: transform` for smooth 60fps animation
