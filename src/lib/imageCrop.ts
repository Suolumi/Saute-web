// Matches the aspect-video (16:9) aspect ratio RecipeCard.svelte renders recipe photos at.
export const RECIPE_CARD_ASPECT_RATIO = 16 / 9

// The crop can't be shrunk (zoomed in) past this many source pixels wide, so the
// resulting image is never smaller than what a RecipeCard would want to display.
export const MIN_CROP_OUTPUT_WIDTH = 800
export const MIN_CROP_OUTPUT_HEIGHT = Math.round(MIN_CROP_OUTPUT_WIDTH / RECIPE_CARD_ASPECT_RATIO)

const MAX_CROP_OUTPUT_WIDTH = 2000

export interface CropRect {
    x: number
    y: number
    width: number
    height: number
}

export type Rotation = 0 | 90 | 180 | 270

// Draws `source` onto a new canvas rotated by `rotationDeg` (clockwise), so callers
// can treat the result as a plain axis-aligned image at the rotated dimensions —
// e.g. to crop it as if it had always been rotated.
export function createRotatedCanvas(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    rotationDeg: Rotation,
): HTMLCanvasElement {
    const swapped = rotationDeg === 90 || rotationDeg === 270
    const canvas = document.createElement('canvas')
    canvas.width = swapped ? sourceHeight : sourceWidth
    canvas.height = swapped ? sourceWidth : sourceHeight
    const ctx = canvas.getContext('2d')
    if (!ctx)
        throw new Error('Could not get canvas context')

    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotationDeg * Math.PI) / 180)
    ctx.drawImage(source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight)
    return canvas
}

export async function cropImageToFile(
    source: CanvasImageSource,
    crop: CropRect,
    fileName: string,
    mimeType = 'image/jpeg',
): Promise<File> {
    let outputWidth = crop.width
    let outputHeight = crop.height
    if (outputWidth > MAX_CROP_OUTPUT_WIDTH) {
        const scale = MAX_CROP_OUTPUT_WIDTH / outputWidth
        outputWidth = MAX_CROP_OUTPUT_WIDTH
        outputHeight = Math.round(outputHeight * scale)
    } else if (outputWidth < MIN_CROP_OUTPUT_WIDTH) {
        // Source image (or the selected crop of it) is smaller than the minimum a
        // RecipeCard wants; upscale rather than deliver an under-sized image.
        const scale = MIN_CROP_OUTPUT_WIDTH / outputWidth
        outputWidth = MIN_CROP_OUTPUT_WIDTH
        outputHeight = Math.round(outputHeight * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(outputWidth)
    canvas.height = Math.round(outputHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx)
        throw new Error('Could not get canvas context')

    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, 0.9))
    if (!blob)
        throw new Error('Could not create image blob')

    return new File([blob], fileName, {type: mimeType})
}
