<script lang="ts">
    import Modal from './Modal.svelte';
    import Button from './Button.svelte';
    import {_} from 'svelte-i18n';
    import {RotateCcw, RotateCw} from '@lucide/svelte';
    import {
        cropImageToFile,
        createRotatedCanvas,
        MIN_CROP_OUTPUT_WIDTH,
        RECIPE_CARD_ASPECT_RATIO,
        type CropRect,
        type Rotation,
    } from '$lib/imageCrop';

    interface Props {
        file: File | null;
        onConfirm: (file: File) => void;
        onCancel: () => void;
    }

    let {file, onConfirm, onCancel}: Props = $props();

    const MAX_DISPLAY_HEIGHT = 420;
    const MAX_ZOOM = 4;

    let imgEl: HTMLImageElement | undefined = $state();
    let imageUrl = $state<string | null>(null);
    let naturalWidth = $state(0);
    let naturalHeight = $state(0);
    let measureWidth = $state(0);
    let zoom = $state(1);
    let centerFracX = $state(0.5);
    let centerFracY = $state(0.5);
    let rotation = $state<Rotation>(0);

    function clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    function resetCrop() {
        zoom = 1;
        centerFracX = 0.5;
        centerFracY = 0.5;
    }

    $effect(() => {
        const currentFile = file;
        resetCrop();
        rotation = 0;
        naturalWidth = 0;
        naturalHeight = 0;

        if (!currentFile) {
            imageUrl = null;
            return;
        }

        const url = URL.createObjectURL(currentFile);
        imageUrl = url;
        return () => URL.revokeObjectURL(url);
    });

    function handleImageLoad() {
        if (!imgEl) return;
        naturalWidth = imgEl.naturalWidth;
        naturalHeight = imgEl.naturalHeight;
    }

    function rotateBy(delta: 90 | -90) {
        rotation = ((rotation + delta + 360) % 360) as Rotation;
        resetCrop();
    }

    // Rotation swaps which of the source image's own axes maps to the display's
    // width/height — everything below (display box, crop rect, etc.) is computed
    // in this rotated bounding-box space.
    let rotationSwapped = $derived(rotation === 90 || rotation === 270);
    let rotatedNaturalWidth = $derived(rotationSwapped ? naturalHeight : naturalWidth);
    let rotatedNaturalHeight = $derived(rotationSwapped ? naturalWidth : naturalHeight);

    let displayScale = $derived(
        rotatedNaturalWidth && rotatedNaturalHeight && measureWidth
            ? Math.min(measureWidth / rotatedNaturalWidth, MAX_DISPLAY_HEIGHT / rotatedNaturalHeight)
            : 0
    );
    let displayWidth = $derived(rotatedNaturalWidth * displayScale);
    let displayHeight = $derived(rotatedNaturalHeight * displayScale);

    // The <img> keeps its own (unrotated) aspect ratio; it's centered in the
    // rotated display box above and spun onto it with a CSS transform.
    let imgDisplayWidth = $derived(rotationSwapped ? displayHeight : displayWidth);
    let imgDisplayHeight = $derived(rotationSwapped ? displayWidth : displayHeight);

    let baseRectWidth = $derived(
        displayHeight > 0 && displayWidth / displayHeight > RECIPE_CARD_ASPECT_RATIO
            ? displayHeight * RECIPE_CARD_ASPECT_RATIO
            : displayWidth
    );
    let baseRectHeight = $derived(baseRectWidth / RECIPE_CARD_ASPECT_RATIO);

    let maxZoom = $derived.by(() => {
        if (!displayScale || !baseRectWidth) return 1;
        const minRectDisplayWidth = MIN_CROP_OUTPUT_WIDTH * displayScale;
        if (minRectDisplayWidth <= 0) return 1;
        return clamp(baseRectWidth / minRectDisplayWidth, 1, MAX_ZOOM);
    });

    $effect(() => {
        if (zoom > maxZoom) zoom = maxZoom;
    });

    let rectWidth = $derived(baseRectWidth / zoom);
    let rectHeight = $derived(baseRectHeight / zoom);
    let travelX = $derived(Math.max(0, displayWidth - rectWidth));
    let travelY = $derived(Math.max(0, displayHeight - rectHeight));
    let rectX = $derived(centerFracX * travelX);
    let rectY = $derived(centerFracY * travelY);

    let dragState: {startX: number; startY: number; startFracX: number; startFracY: number} | null = null;

    function onRectPointerDown(e: PointerEvent) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragState = {startX: e.clientX, startY: e.clientY, startFracX: centerFracX, startFracY: centerFracY};
    }

    function onRectPointerMove(e: PointerEvent) {
        if (!dragState) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        centerFracX = clamp(dragState.startFracX + (travelX > 0 ? dx / travelX : 0), 0, 1);
        centerFracY = clamp(dragState.startFracY + (travelY > 0 ? dy / travelY : 0), 0, 1);
    }

    function onRectPointerUp() {
        dragState = null;
    }

    // Handles resize the rect symmetrically about its center, exactly like the zoom
    // slider (rectWidth = baseRectWidth / zoom) — dragging a handle just sets zoom
    // via drag distance instead of the slider.
    const RESIZE_HANDLES = [
        {id: 'nw', sx: -1, sy: -1},
        {id: 'ne', sx: 1, sy: -1},
        {id: 'se', sx: 1, sy: 1},
        {id: 'sw', sx: -1, sy: 1},
    ] as const;

    function handleCursor(sx: number, sy: number) {
        return sx === sy ? 'nwse-resize' : 'nesw-resize';
    }

    let resizeState: {startX: number; startY: number; startRectWidth: number; sx: number; sy: number} | null = null;

    function onHandlePointerDown(e: PointerEvent, sx: number, sy: number) {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        resizeState = {startX: e.clientX, startY: e.clientY, startRectWidth: rectWidth, sx, sy};
    }

    function onHandlePointerMove(e: PointerEvent) {
        if (!resizeState) return;
        const dx = e.clientX - resizeState.startX;
        const dy = e.clientY - resizeState.startY;
        const {sx, sy} = resizeState;
        const deltaWidth = (dx * sx + dy * sy * RECIPE_CARD_ASPECT_RATIO) / 2;

        const minRectWidth = baseRectWidth / maxZoom;
        const newRectWidth = clamp(resizeState.startRectWidth + deltaWidth, minRectWidth, baseRectWidth);
        zoom = clamp(baseRectWidth / newRectWidth, 1, maxZoom);
    }

    function onHandlePointerUp() {
        resizeState = null;
    }

    function onRectKeydown(e: KeyboardEvent) {
        const step = 0.02;
        if (e.key === 'ArrowLeft') centerFracX = clamp(centerFracX - step, 0, 1);
        else if (e.key === 'ArrowRight') centerFracX = clamp(centerFracX + step, 0, 1);
        else if (e.key === 'ArrowUp') centerFracY = clamp(centerFracY - step, 0, 1);
        else if (e.key === 'ArrowDown') centerFracY = clamp(centerFracY + step, 0, 1);
        else return;
        e.preventDefault();
    }

    async function handleConfirm() {
        if (!file || !imgEl || !naturalWidth || !displayScale) return;
        const scale = 1 / displayScale;
        const crop: CropRect = {
            x: rectX * scale,
            y: rectY * scale,
            width: rectWidth * scale,
            height: rectHeight * scale,
        };
        const source = rotation === 0
            ? imgEl
            : createRotatedCanvas(imgEl, naturalWidth, naturalHeight, rotation);
        const cropped = await cropImageToFile(source, crop, file.name, file.type || 'image/jpeg');
        onConfirm(cropped);
    }
</script>

<Modal
        open={!!file}
        title={$_('imageCrop.title')}
        description={$_('imageCrop.description')}
        closeOnBackdrop={false}
        onClose={onCancel}
        class="max-w-2xl"
>
    <div class="w-full" bind:clientWidth={measureWidth}>
        {#if imageUrl}
            <div
                    class="relative mx-auto overflow-hidden bg-black touch-none select-none"
                    style="width:{displayWidth}px; height:{displayHeight}px"
            >
                <img
                        bind:this={imgEl}
                        src={imageUrl}
                        onload={handleImageLoad}
                        alt=""
                        draggable="false"
                        class="absolute top-1/2 left-1/2 pointer-events-none select-none"
                        style="width:{imgDisplayWidth}px; height:{imgDisplayHeight}px; transform: translate(-50%, -50%) rotate({rotation}deg);"
                />
                {#if naturalWidth}
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <div
                            class="absolute border-2 border-white/90 cursor-move"
                            style="left:{rectX}px; top:{rectY}px; width:{rectWidth}px; height:{rectHeight}px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);"
                            onpointerdown={onRectPointerDown}
                            onpointermove={onRectPointerMove}
                            onpointerup={onRectPointerUp}
                            onpointercancel={onRectPointerUp}
                            onkeydown={onRectKeydown}
                            role="slider"
                            aria-label={$_('imageCrop.dragHint')}
                            aria-valuenow={Math.round(centerFracX * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            tabindex="0"
                    >
                        {#each RESIZE_HANDLES as handle (handle.id)}
                            <div
                                    class="absolute w-3.5 h-3.5 rounded-sm bg-white border border-black/40 shadow touch-none"
                                    style="
                                        left:{handle.sx === -1 ? '0%' : handle.sx === 1 ? '100%' : '50%'};
                                        top:{handle.sy === -1 ? '0%' : handle.sy === 1 ? '100%' : '50%'};
                                        transform: translate(-50%, -50%);
                                        cursor: {handleCursor(handle.sx, handle.sy)};
                                    "
                                    onpointerdown={(e) => onHandlePointerDown(e, handle.sx, handle.sy)}
                                    onpointermove={onHandlePointerMove}
                                    onpointerup={onHandlePointerUp}
                                    onpointercancel={onHandlePointerUp}
                                    aria-hidden="true"
                            ></div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <div class="mt-4 flex items-center gap-3">
        <span class="text-sm text-muted-foreground whitespace-nowrap">{$_('imageCrop.zoom')}</span>
        <input
                type="range"
                min="1"
                max={maxZoom}
                step="0.01"
                bind:value={zoom}
                disabled={maxZoom <= 1.001}
                class="flex-1"
        />
        <div class="flex items-center gap-1">
            <button
                    type="button"
                    onclick={() => rotateBy(-90)}
                    aria-label={$_('imageCrop.rotateCcw')}
                    class="p-2 rounded-md hover:bg-accent hover:text-accent-foreground hover:cursor-pointer"
            >
                <RotateCcw class="w-4 h-4" />
            </button>
            <button
                    type="button"
                    onclick={() => rotateBy(90)}
                    aria-label={$_('imageCrop.rotateCw')}
                    class="p-2 rounded-md hover:bg-accent hover:text-accent-foreground hover:cursor-pointer"
            >
                <RotateCw class="w-4 h-4" />
            </button>
        </div>
    </div>

    {#snippet footer()}
        <Button variant="outline" onclick={onCancel}>{$_('imageCrop.cancel')}</Button>
        <Button onclick={handleConfirm}>{$_('imageCrop.confirm')}</Button>
    {/snippet}
</Modal>
