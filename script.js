/* ==========================================================
   BYTEZY Menu Editor — Script
   Features:
     · Drag-to-move all text blocks
     · Resize width by dragging bottom-right corner handle
     · Floating toolbar: font-size +/- and position reset
     · Download as PNG (html2canvas)
   ========================================================== */

class MenuEditor {
    constructor() {
        this.selectedEl    = null;
        this.isDragging    = false;
        this.isResizing    = false;

        // Drag state
        this.dragStartX    = 0;
        this.dragStartY    = 0;
        this.elStartLeft   = 0;
        this.elStartTop    = 0;

        // Resize state
        this.resizeStartX  = 0;
        this.resizeStartY  = 0;
        this.elStartW      = 0;
        this.elStartH      = 0;

        this.toolbar       = null;
        this.container     = document.getElementById('rosterToDownload');

        this.init();
    }

    /* ── Init ───────────────────────────────────────────── */
    init() {
        this.createToolbar();
        this.makeInteractive();
        this.bindGlobal();
    }

    /* ── Floating Toolbar ───────────────────────────────── */
    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'floatingToolbar';
        this.toolbar.style.display = 'none';
        this.toolbar.innerHTML = `
            <span class="tb-label">Font</span>
            <span class="tb-value" id="tbFontSize">—</span>
            <button id="tbMinus" title="Decrease font size">A−</button>
            <button id="tbPlus"  title="Increase font size">A+</button>
            <div class="tb-sep"></div>
            <button id="tbBold"  title="Toggle bold">𝐁</button>
            <div class="tb-sep"></div>
            <button class="tb-close" id="tbClose" title="Deselect">✕</button>
        `;
        document.body.appendChild(this.toolbar);

        document.getElementById('tbMinus').addEventListener('mousedown', e => { e.stopPropagation(); this.changeFontSize(-2); });
        document.getElementById('tbPlus').addEventListener('mousedown',  e => { e.stopPropagation(); this.changeFontSize(+2); });
        document.getElementById('tbBold').addEventListener('mousedown',  e => { e.stopPropagation(); this.toggleBold(); });
        document.getElementById('tbClose').addEventListener('mousedown', e => { e.stopPropagation(); this.deselect(); });

        // Prevent toolbar clicks from deselecting
        this.toolbar.addEventListener('mousedown', e => e.stopPropagation());
    }

    positionToolbar() {
        if (!this.selectedEl) return;
        const rect = this.selectedEl.getBoundingClientRect();
        const tb   = this.toolbar;
        tb.style.display = 'flex';
        let top  = rect.top - tb.offsetHeight - 12;
        let left = rect.left;
        if (top < 60) top = rect.bottom + 10;
        if (left + tb.offsetWidth > window.innerWidth) left = window.innerWidth - tb.offsetWidth - 12;
        tb.style.top  = top  + 'px';
        tb.style.left = left + 'px';
    }

    updateToolbarFontSize() {
        if (!this.selectedEl) return;
        const fs = this.getEffectiveFontSize();
        document.getElementById('tbFontSize').textContent = fs + 'px';
    }

    /* ── Make elements interactive ──────────────────────── */
    makeInteractive() {
        // Target every individual .el line
        const elements = this.container.querySelectorAll('.el');
        elements.forEach(el => {
            el.classList.add('interactive-el');

            // Add drag handle strip
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            el.prepend(dragHandle);

            // Add corner resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            el.appendChild(resizeHandle);

            // Drag via handle
            dragHandle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                this.startDrag(e, el);
            });

            // Resize via corner
            resizeHandle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                this.startResize(e, el);
            });

            // Click on border/background selects (not inside text)
            el.addEventListener('mousedown', e => {
                // If clicking directly on the el div (not a child text node or span)
                if (e.target === el) this.selectEl(el);
            });
        });
    }

    /* ── Selection ──────────────────────────────────────── */
    selectEl(el) {
        if (this.selectedEl && this.selectedEl !== el) {
            this.selectedEl.classList.remove('selected');
        }
        this.selectedEl = el;
        el.classList.add('selected');
        this.updateToolbarFontSize();
        requestAnimationFrame(() => this.positionToolbar());
    }

    deselect() {
        if (this.selectedEl) {
            this.selectedEl.classList.remove('selected');
            this.selectedEl = null;
        }
        this.toolbar.style.display = 'none';
    }

    /* ── Drag ───────────────────────────────────────────── */
    startDrag(e, el) {
        this.isDragging  = true;
        this.selectedEl  = el;
        this.dragStartX  = e.clientX;
        this.dragStartY  = e.clientY;
        this.elStartLeft = parseInt(el.style.left) || el.offsetLeft;
        this.elStartTop  = parseInt(el.style.top)  || el.offsetTop;

        el.classList.add('selected', 'dragging');
        this.toolbar.style.display = 'none';
        document.body.style.cursor = 'grabbing';
    }

    doDrag(e) {
        if (!this.isDragging || !this.selectedEl) return;
        const dx  = e.clientX - this.dragStartX;
        const dy  = e.clientY - this.dragStartY;

        // Account for canvas scale (browser zoom makes canvas appear smaller)
        const containerRect  = this.container.getBoundingClientRect();
        const scaleX = this.container.offsetWidth  / containerRect.width;
        const scaleY = this.container.offsetHeight / containerRect.height;

        let newLeft = this.elStartLeft + dx * scaleX;
        let newTop  = this.elStartTop  + dy * scaleY;

        // Clamp inside canvas
        newLeft = Math.max(0, Math.min(newLeft, this.container.offsetWidth  - this.selectedEl.offsetWidth));
        newTop  = Math.max(0, Math.min(newTop,  this.container.offsetHeight - this.selectedEl.offsetHeight));

        this.selectedEl.style.left = newLeft + 'px';
        this.selectedEl.style.top  = newTop  + 'px';
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.selectedEl) {
            this.selectedEl.classList.remove('dragging');
            requestAnimationFrame(() => this.positionToolbar());
        }
        document.body.style.cursor = '';
    }

    /* ── Resize ─────────────────────────────────────────── */
    startResize(e, el) {
        this.isResizing   = true;
        this.selectedEl   = el;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.elStartW     = el.offsetWidth;
        this.elStartH     = el.offsetHeight;

        el.classList.add('selected');
        document.body.style.cursor = 'se-resize';
        this.toolbar.style.display = 'none';
    }

    doResize(e) {
        if (!this.isResizing || !this.selectedEl) return;
        const containerRect = this.container.getBoundingClientRect();
        const scaleX = this.container.offsetWidth  / containerRect.width;
        const scaleY = this.container.offsetHeight / containerRect.height;

        const dx = (e.clientX - this.resizeStartX) * scaleX;
        const dy = (e.clientY - this.resizeStartY) * scaleY;

        const newW = Math.max(80,  this.elStartW + dx);
        const newH = Math.max(30,  this.elStartH + dy);

        this.selectedEl.style.width     = newW + 'px';
        this.selectedEl.style.minHeight = newH + 'px';
    }

    endResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        document.body.style.cursor = '';
        requestAnimationFrame(() => this.positionToolbar());
    }

    /* ── Font size ──────────────────────────────────────── */
    getEffectiveFontSize() {
        if (!this.selectedEl) return 16;
        const fs = parseFloat(getComputedStyle(this.selectedEl).fontSize);
        return Math.round(fs);
    }

    changeFontSize(delta) {
        if (!this.selectedEl) return;
        const current = this.getEffectiveFontSize();
        const next    = Math.max(8, current + delta);
        this.selectedEl.style.fontSize = next + 'px';
        // Propagate to all direct-text children that have their own font-size set
        this.selectedEl.querySelectorAll('.day-title, .food-desc, .section-title, .price-highlight').forEach(child => {
            const childFs = parseFloat(getComputedStyle(child).fontSize);
            child.style.fontSize = Math.max(8, childFs + delta) + 'px';
        });
        this.updateToolbarFontSize();
    }

    toggleBold() {
        if (!this.selectedEl) return;
        const isBold = getComputedStyle(this.selectedEl).fontWeight >= 700;
        this.selectedEl.style.fontWeight = isBold ? '400' : '900';
    }

    /* ── Global mouse listeners ─────────────────────────── */
    bindGlobal() {
        document.addEventListener('mousemove', e => {
            if (this.isDragging)  this.doDrag(e);
            if (this.isResizing)  this.doResize(e);
        });

        document.addEventListener('mouseup', () => {
            this.endDrag();
            this.endResize();
        });

        // Deselect when clicking on canvas background
        this.container.addEventListener('mousedown', e => {
            if (e.target === this.container) this.deselect();
        });

        // Deselect when clicking outside
        document.addEventListener('mousedown', e => {
            if (!this.container.contains(e.target) && !this.toolbar.contains(e.target)) {
                this.deselect();
            }
        });
    }
}

/* ── Download ─────────────────────────────────────────── */
function downloadImage() {
    const roster  = document.getElementById('rosterToDownload');
    const toolbar = document.getElementById('floatingToolbar');

    // 1. Deselect & hide all editor chrome
    if (window.editor) window.editor.deselect();
    roster.querySelectorAll('.drag-handle, .resize-handle').forEach(h => h.style.display = 'none');
    roster.querySelectorAll('.interactive-el').forEach(el => el.classList.remove('selected', 'dragging'));
    if (toolbar) toolbar.style.display = 'none';

    // 2. Save the live NodeList of editables BEFORE removing the attribute
    const editables = Array.from(roster.querySelectorAll('[contenteditable]'));
    editables.forEach(el => el.removeAttribute('contenteditable'));

    // 3. Strip container chrome
    const origShadow = roster.style.boxShadow;
    const origRadius = roster.style.borderRadius;
    roster.style.boxShadow    = 'none';
    roster.style.borderRadius = '0';

    // 4. Capture after paint
    setTimeout(() => {
        html2canvas(roster, {
            scale       : 1,
            useCORS     : true,
            allowTaint  : true,   // required for local file:// background images
            backgroundColor: null,
            width       : 2000,
            height      : 1414,
            logging     : false
        }).then(canvas => {
            // Restore container
            roster.style.boxShadow    = origShadow;
            roster.style.borderRadius = origRadius;

            // Restore editor chrome
            roster.querySelectorAll('.drag-handle, .resize-handle').forEach(h => h.style.display = '');

            // Restore contenteditable on every element that had it
            editables.forEach(el => {
                el.setAttribute('contenteditable', 'true');
                el.setAttribute('spellcheck', 'false');
            });

            // Trigger download
            const link = document.createElement('a');
            link.download = 'BYTEZY_Menu_Roster.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            // Restore even on error
            roster.style.boxShadow    = origShadow;
            roster.style.borderRadius = origRadius;
            roster.querySelectorAll('.drag-handle, .resize-handle').forEach(h => h.style.display = '');
            editables.forEach(el => {
                el.setAttribute('contenteditable', 'true');
                el.setAttribute('spellcheck', 'false');
            });
            alert('Download failed: ' + err.message);
            console.error(err);
        });
    }, 250); // give the browser time to repaint without editor chrome
}

/* ── Boot ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new MenuEditor();
});
