@import "tailwindcss";

@theme {
  --color-nude: #fdfbf7;
  --color-nude-dark: #fcf6ed;
  --color-brand: #f07e26;
  --brand-rgb: 240, 126, 38;
  --color-brand-dark: #8c4200;
  --color-brand-light: #fff5eb;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

html, body, #root {
  height: 100%;
}

body {
  background-color: white;
  color: var(--color-brand-dark);
  font-family: var(--font-sans);
  margin: 0;
  padding: 0;
  position: relative;
  min-height: 100%;
}

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95%;
  height: 95%;
  background-image: url('/logo.svg');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  opacity: 0.05;
  pointer-events: none;
  z-index: 0;
}

.btn-primary {
  @apply inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-brand/30 hover:shadow-brand/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-500 disabled:opacity-50 disabled:pointer-events-none;
}

.btn-secondary {
  @apply inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-brand font-black text-xs uppercase tracking-[0.2em] rounded-2xl border-2 border-brand/20 shadow-lg shadow-brand/10 hover:bg-brand hover:text-white hover:border-brand hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-500 disabled:opacity-50 disabled:pointer-events-none;
}

.card {
  background-color: var(--color-nude-dark);
  border: 1px solid rgba(240, 126, 38, 0.08);
  padding: 2rem;
  border-radius: 1.25rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  touch-action: none;
}

.selected-effect {
  border-color: var(--color-brand) !important;
  background-color: var(--color-brand-light) !important;
  box-shadow: 0 0 0 1px var(--color-brand), 0 12px 32px rgba(240, 126, 38, 0.2) !important;
  transform: translateY(-4px);
}

.selected-effect-inner {
  background-color: var(--color-brand) !important;
  color: white !important;
  box-shadow: 0 6px 16px rgba(240, 126, 38, 0.3) !important;
  transform: scale(1.02);
}

.btn-action {
  @apply inline-flex items-center justify-center gap-4 px-10 py-8 bg-brand text-white font-black text-xl uppercase tracking-[0.25em] rounded-[2rem] shadow-2xl shadow-brand/40 hover:shadow-brand/50 hover:-translate-y-1.5 active:translate-y-0 active:scale-[0.98] transition-all duration-700 disabled:opacity-50 disabled:pointer-events-none;
}

.btn-danger {
  @apply inline-flex items-center justify-center gap-2 px-8 py-4 bg-red-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-red-500/30 hover:shadow-red-500/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-500 disabled:opacity-50 disabled:pointer-events-none;
}

.input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(240, 126, 38, 0.2);
  background-color: white;
  color: var(--color-brand-dark);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgba(240, 126, 38, 0.1);
}

.label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-brand);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

