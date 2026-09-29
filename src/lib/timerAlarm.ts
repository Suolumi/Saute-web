// Cooking-timer alarm sound. Synthesized with the Web Audio API rather than
// a bundled audio file - no asset to ship, and a plain oscillator beep is
// plenty for "your timer is done".
let ctx: AudioContext | null = null

// Must be called synchronously from a user gesture (the "start timer" click)
// to satisfy the browser's autoplay policy. The beep played later, when the
// timer actually expires, is unattended - but it reuses this same
// already-unlocked context instead of needing a fresh gesture of its own.
export function unlockAlarmAudio() {
    if (!ctx)
        ctx = new AudioContext()
    else if (ctx.state === 'suspended')
        ctx.resume()
}

// A short three-beep pattern.
export function playAlarmBeep() {
    if (!ctx) return
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        const start = now + i * 0.35
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02)
        gain.gain.linearRampToValueAtTime(0, start + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.3)
    }
}
