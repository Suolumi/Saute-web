<script>
    let {
        value = $bindable(''),
        placeholder = '',
        disabled = false,
        required = false,
        id = '',
        rows = 3,
        autoGrow = false,
        class: className = '',
        ...props
    } = $props();

    /** @type {HTMLTextAreaElement | undefined} */
    let textarea = $state();

    // Growing with the content keeps the box from scrolling on its own, so a
    // touch swipe over it scrolls the page.
    $effect(() => {
        value;
        if (!autoGrow || !textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
    });

    const baseClasses = 'w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-vertical';
</script>

<textarea
        bind:this={textarea}
        {id}
        {placeholder}
        {disabled}
        {required}
        {rows}
        bind:value
        class="{baseClasses} {className}"
        {...props}
></textarea>
