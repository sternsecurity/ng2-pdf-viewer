var PdfViewerComponent_1;
import { __decorate } from "tslib";
/**
 * Created by vadimdez on 21/06/16.
 */
import { Component, Input, Output, ElementRef, EventEmitter, OnChanges, SimpleChanges, OnInit, HostListener, OnDestroy, ViewChild, AfterViewChecked } from '@angular/core';
import { createEventBus } from '../utils/event-bus-utils';
let PDFJS;
let PDFJSViewer;
function isSSR() {
    return typeof window === 'undefined';
}
if (!isSSR()) {
    PDFJS = require('pdfjs-dist/build/pdf');
    PDFJSViewer = require('pdfjs-dist/web/pdf_viewer');
    PDFJS.verbosity = PDFJS.VerbosityLevel.ERRORS;
}
export var RenderTextMode;
(function (RenderTextMode) {
    RenderTextMode[RenderTextMode["DISABLED"] = 0] = "DISABLED";
    RenderTextMode[RenderTextMode["ENABLED"] = 1] = "ENABLED";
    RenderTextMode[RenderTextMode["ENHANCED"] = 2] = "ENHANCED";
})(RenderTextMode || (RenderTextMode = {}));
let PdfViewerComponent = PdfViewerComponent_1 = class PdfViewerComponent {
    constructor(element) {
        this.element = element;
        this.isVisible = false;
        this._cMapsUrl = typeof PDFJS !== 'undefined'
            ? `https://unpkg.com/pdfjs-dist@${PDFJS.version}/cmaps/`
            : null;
        this._renderText = true;
        this._renderTextMode = RenderTextMode.ENABLED;
        this._stickToPage = false;
        this._originalSize = true;
        this._page = 1;
        this._zoom = 1;
        this._zoomScale = 'page-width';
        this._rotation = 0;
        this._showAll = true;
        this._canAutoResize = true;
        this._fitToPage = false;
        this._externalLinkTarget = 'blank';
        this._showBorders = false;
        this.isInitialized = false;
        this.afterLoadComplete = new EventEmitter();
        this.pageRendered = new EventEmitter();
        this.textLayerRendered = new EventEmitter();
        this.onError = new EventEmitter();
        this.onProgress = new EventEmitter();
        this.pageChange = new EventEmitter(true);
        if (isSSR()) {
            return;
        }
        let pdfWorkerSrc;
        if (window.hasOwnProperty('pdfWorkerSrc') &&
            typeof window.pdfWorkerSrc === 'string' &&
            window.pdfWorkerSrc) {
            pdfWorkerSrc = window.pdfWorkerSrc;
        }
        else {
            pdfWorkerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;
        }
        PDFJS.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    }
    set cMapsUrl(cMapsUrl) {
        this._cMapsUrl = cMapsUrl;
    }
    set page(_page) {
        _page = parseInt(_page, 10) || 1;
        const orginalPage = _page;
        if (this._pdf) {
            _page = this.getValidPageNumber(_page);
        }
        this._page = _page;
        if (orginalPage !== _page) {
            this.pageChange.emit(_page);
        }
    }
    set renderText(renderText) {
        this._renderText = renderText;
    }
    set renderTextMode(renderTextMode) {
        this._renderTextMode = renderTextMode;
    }
    set originalSize(originalSize) {
        this._originalSize = originalSize;
    }
    set showAll(value) {
        this._showAll = value;
    }
    set stickToPage(value) {
        this._stickToPage = value;
    }
    set zoom(value) {
        if (value <= 0) {
            return;
        }
        this._zoom = value;
    }
    get zoom() {
        return this._zoom;
    }
    set zoomScale(value) {
        this._zoomScale = value;
    }
    get zoomScale() {
        return this._zoomScale;
    }
    set rotation(value) {
        if (!(typeof value === 'number' && value % 90 === 0)) {
            console.warn('Invalid pages rotation angle.');
            return;
        }
        this._rotation = value;
    }
    set externalLinkTarget(value) {
        this._externalLinkTarget = value;
    }
    set autoresize(value) {
        this._canAutoResize = Boolean(value);
    }
    set fitToPage(value) {
        this._fitToPage = Boolean(value);
    }
    set showBorders(value) {
        this._showBorders = Boolean(value);
    }
    static getLinkTarget(type) {
        switch (type) {
            case 'blank':
                return PDFJS.LinkTarget.BLANK;
            case 'none':
                return PDFJS.LinkTarget.NONE;
            case 'self':
                return PDFJS.LinkTarget.SELF;
            case 'parent':
                return PDFJS.LinkTarget.PARENT;
            case 'top':
                return PDFJS.LinkTarget.TOP;
        }
        return null;
    }
    static setExternalLinkTarget(type) {
        const linkTarget = PdfViewerComponent_1.getLinkTarget(type);
        if (linkTarget !== null) {
            PDFJS.externalLinkTarget = linkTarget;
        }
    }
    ngAfterViewChecked() {
        if (this.isInitialized) {
            return;
        }
        const offset = this.pdfViewerContainer.nativeElement.offsetParent;
        if (this.isVisible === true && offset == null) {
            this.isVisible = false;
            return;
        }
        if (this.isVisible === false && offset != null) {
            this.isVisible = true;
            setTimeout(() => {
                this.ngOnInit();
                this.ngOnChanges({ src: this.src });
            });
        }
    }
    ngOnInit() {
        if (!isSSR() && this.isVisible) {
            this.isInitialized = true;
            this.setupMultiPageViewer();
            this.setupSinglePageViewer();
        }
    }
    ngOnDestroy() {
        this.clear();
    }
    onPageResize() {
        if (!this._canAutoResize || !this._pdf) {
            return;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
            this.updateSize();
        }, 100);
    }
    get pdfLinkService() {
        return this._showAll
            ? this.pdfMultiPageLinkService
            : this.pdfSinglePageLinkService;
    }
    get pdfViewer() {
        return this.getCurrentViewer();
    }
    get pdfFindController() {
        return this._showAll
            ? this.pdfMultiPageFindController
            : this.pdfSinglePageFindController;
    }
    ngOnChanges(changes) {
        if (isSSR() || !this.isVisible) {
            return;
        }
        if ('src' in changes) {
            this.loadPDF();
        }
        else if (this._pdf) {
            if ('renderText' in changes) {
                this.getCurrentViewer().textLayerMode = this._renderText
                    ? this._renderTextMode
                    : RenderTextMode.DISABLED;
                this.resetPdfDocument();
            }
            else if ('showAll' in changes) {
                this.resetPdfDocument();
            }
            if ('page' in changes) {
                if (changes['page'].currentValue === this._latestScrolledPage) {
                    return;
                }
                // New form of page changing: The viewer will now jump to the specified page when it is changed.
                // This behavior is introducedby using the PDFSinglePageViewer
                this.getCurrentViewer().scrollPageIntoView({ pageNumber: this._page });
            }
            this.update();
        }
    }
    updateSize() {
        const currentViewer = this.getCurrentViewer();
        this._pdf
            .getPage(currentViewer.currentPageNumber)
            .then((page) => {
            const rotation = this._rotation || page.rotate;
            const viewportWidth = page.getViewport({
                scale: this._zoom,
                rotation
            }).width * PdfViewerComponent_1.CSS_UNITS;
            let scale = this._zoom;
            let stickToPage = true;
            // Scale the document when it shouldn't be in original size or doesn't fit into the viewport
            if (!this._originalSize ||
                (this._fitToPage &&
                    viewportWidth > this.pdfViewerContainer.nativeElement.clientWidth)) {
                const viewPort = page.getViewport({ scale: 1, rotation });
                scale = this.getScale(viewPort.width, viewPort.height);
                stickToPage = !this._stickToPage;
            }
            currentViewer._setScale(scale, stickToPage);
        });
    }
    clear() {
        if (this.loadingTask && !this.loadingTask.destroyed) {
            this.loadingTask.destroy();
        }
        if (this._pdf) {
            this._pdf.destroy();
            this._pdf = null;
            this.pdfMultiPageViewer.setDocument(null);
            this.pdfSinglePageViewer.setDocument(null);
            this.pdfMultiPageLinkService.setDocument(null, null);
            this.pdfSinglePageLinkService.setDocument(null, null);
            this.pdfMultiPageFindController.setDocument(null);
            this.pdfSinglePageFindController.setDocument(null);
        }
    }
    setupMultiPageViewer() {
        PDFJS.disableTextLayer = !this._renderText;
        PdfViewerComponent_1.setExternalLinkTarget(this._externalLinkTarget);
        const eventBus = createEventBus(PDFJSViewer);
        eventBus.on('pagerendered', e => {
            this.pageRendered.emit(e);
        });
        eventBus.on('pagechanging', e => {
            if (this.pageScrollTimeout) {
                clearTimeout(this.pageScrollTimeout);
            }
            this.pageScrollTimeout = setTimeout(() => {
                this._latestScrolledPage = e.pageNumber;
                this.pageChange.emit(e.pageNumber);
            }, 100);
        });
        eventBus.on('textlayerrendered', e => {
            this.textLayerRendered.emit(e);
        });
        this.pdfMultiPageLinkService = new PDFJSViewer.PDFLinkService({ eventBus });
        this.pdfMultiPageFindController = new PDFJSViewer.PDFFindController({
            linkService: this.pdfMultiPageLinkService,
            eventBus
        });
        const pdfOptions = {
            eventBus: eventBus,
            container: this.element.nativeElement.querySelector('div'),
            removePageBorders: !this._showBorders,
            linkService: this.pdfMultiPageLinkService,
            textLayerMode: this._renderText
                ? this._renderTextMode
                : RenderTextMode.DISABLED,
            findController: this.pdfMultiPageFindController
        };
        this.pdfMultiPageViewer = new PDFJSViewer.PDFViewer(pdfOptions);
        this.pdfMultiPageLinkService.setViewer(this.pdfMultiPageViewer);
        this.pdfMultiPageFindController.setDocument(this._pdf);
    }
    setupSinglePageViewer() {
        PDFJS.disableTextLayer = !this._renderText;
        PdfViewerComponent_1.setExternalLinkTarget(this._externalLinkTarget);
        const eventBus = createEventBus(PDFJSViewer);
        eventBus.on('pagechanging', e => {
            if (e.pageNumber != this._page) {
                this.page = e.pageNumber;
            }
        });
        eventBus.on('pagerendered', e => {
            this.pageRendered.emit(e);
        });
        eventBus.on('textlayerrendered', e => {
            this.textLayerRendered.emit(e);
        });
        this.pdfSinglePageLinkService = new PDFJSViewer.PDFLinkService({
            eventBus
        });
        this.pdfSinglePageFindController = new PDFJSViewer.PDFFindController({
            linkService: this.pdfSinglePageLinkService,
            eventBus
        });
        const pdfOptions = {
            eventBus: eventBus,
            container: this.element.nativeElement.querySelector('div'),
            removePageBorders: !this._showBorders,
            linkService: this.pdfSinglePageLinkService,
            textLayerMode: this._renderText
                ? this._renderTextMode
                : RenderTextMode.DISABLED,
            findController: this.pdfSinglePageFindController
        };
        this.pdfSinglePageViewer = new PDFJSViewer.PDFSinglePageViewer(pdfOptions);
        this.pdfSinglePageLinkService.setViewer(this.pdfSinglePageViewer);
        this.pdfSinglePageFindController.setDocument(this._pdf);
        this.pdfSinglePageViewer._currentPageNumber = this._page;
    }
    getValidPageNumber(page) {
        if (page < 1) {
            return 1;
        }
        if (page > this._pdf.numPages) {
            return this._pdf.numPages;
        }
        return page;
    }
    getDocumentParams() {
        const srcType = typeof this.src;
        if (!this._cMapsUrl) {
            return this.src;
        }
        const params = {
            cMapUrl: this._cMapsUrl,
            cMapPacked: true
        };
        if (srcType === 'string') {
            params.url = this.src;
        }
        else if (srcType === 'object') {
            if (this.src.byteLength !== undefined) {
                params.data = this.src;
            }
            else {
                Object.assign(params, this.src);
            }
        }
        return params;
    }
    loadPDF() {
        if (!this.src) {
            return;
        }
        if (this.lastLoaded === this.src) {
            this.update();
            return;
        }
        this.clear();
        this.loadingTask = PDFJS.getDocument(this.getDocumentParams());
        this.loadingTask.onProgress = (progressData) => {
            this.onProgress.emit(progressData);
        };
        const src = this.src;
        this.loadingTask.promise.then((pdf) => {
            this._pdf = pdf;
            this.lastLoaded = src;
            this.afterLoadComplete.emit(pdf);
            if (!this.pdfMultiPageViewer) {
                this.setupMultiPageViewer();
                this.setupSinglePageViewer();
            }
            this.resetPdfDocument();
            this.update();
        }, (error) => {
            this.onError.emit(error);
        });
    }
    update() {
        this.page = this._page;
        this.render();
    }
    render() {
        this._page = this.getValidPageNumber(this._page);
        const currentViewer = this.getCurrentViewer();
        if (this._rotation !== 0 ||
            currentViewer.pagesRotation !== this._rotation) {
            setTimeout(() => {
                currentViewer.pagesRotation = this._rotation;
            });
        }
        if (this._stickToPage) {
            setTimeout(() => {
                currentViewer.currentPageNumber = this._page;
            });
        }
        this.updateSize();
    }
    getScale(viewportWidth, viewportHeight) {
        const borderSize = (this._showBorders ? 2 * PdfViewerComponent_1.BORDER_WIDTH : 0);
        const pdfContainerWidth = this.pdfViewerContainer.nativeElement.clientWidth - borderSize;
        const pdfContainerHeight = this.pdfViewerContainer.nativeElement.clientHeight - borderSize;
        if (pdfContainerHeight === 0 || viewportHeight === 0 || pdfContainerWidth === 0 || viewportWidth === 0) {
            return 1;
        }
        let ratio = 1;
        switch (this._zoomScale) {
            case 'page-fit':
                ratio = Math.min((pdfContainerHeight / viewportHeight), (pdfContainerWidth / viewportWidth));
                break;
            case 'page-height':
                ratio = (pdfContainerHeight / viewportHeight);
                break;
            case 'page-width':
            default:
                ratio = (pdfContainerWidth / viewportWidth);
                break;
        }
        return (this._zoom * ratio) / PdfViewerComponent_1.CSS_UNITS;
    }
    getCurrentViewer() {
        return this._showAll ? this.pdfMultiPageViewer : this.pdfSinglePageViewer;
    }
    resetPdfDocument() {
        this.pdfFindController.setDocument(this._pdf);
        if (this._showAll) {
            this.pdfSinglePageViewer.setDocument(null);
            this.pdfSinglePageLinkService.setDocument(null);
            this.pdfMultiPageViewer.setDocument(this._pdf);
            this.pdfMultiPageLinkService.setDocument(this._pdf, null);
        }
        else {
            this.pdfMultiPageViewer.setDocument(null);
            this.pdfMultiPageLinkService.setDocument(null);
            this.pdfSinglePageViewer.setDocument(this._pdf);
            this.pdfSinglePageLinkService.setDocument(this._pdf, null);
        }
    }
};
PdfViewerComponent.CSS_UNITS = 96.0 / 72.0;
PdfViewerComponent.BORDER_WIDTH = 9;
PdfViewerComponent.ctorParameters = () => [
    { type: ElementRef }
];
__decorate([
    ViewChild('pdfViewerContainer')
], PdfViewerComponent.prototype, "pdfViewerContainer", void 0);
__decorate([
    Output('after-load-complete')
], PdfViewerComponent.prototype, "afterLoadComplete", void 0);
__decorate([
    Output('page-rendered')
], PdfViewerComponent.prototype, "pageRendered", void 0);
__decorate([
    Output('text-layer-rendered')
], PdfViewerComponent.prototype, "textLayerRendered", void 0);
__decorate([
    Output('error')
], PdfViewerComponent.prototype, "onError", void 0);
__decorate([
    Output('on-progress')
], PdfViewerComponent.prototype, "onProgress", void 0);
__decorate([
    Output()
], PdfViewerComponent.prototype, "pageChange", void 0);
__decorate([
    Input()
], PdfViewerComponent.prototype, "src", void 0);
__decorate([
    Input('c-maps-url')
], PdfViewerComponent.prototype, "cMapsUrl", null);
__decorate([
    Input('page')
], PdfViewerComponent.prototype, "page", null);
__decorate([
    Input('render-text')
], PdfViewerComponent.prototype, "renderText", null);
__decorate([
    Input('render-text-mode')
], PdfViewerComponent.prototype, "renderTextMode", null);
__decorate([
    Input('original-size')
], PdfViewerComponent.prototype, "originalSize", null);
__decorate([
    Input('show-all')
], PdfViewerComponent.prototype, "showAll", null);
__decorate([
    Input('stick-to-page')
], PdfViewerComponent.prototype, "stickToPage", null);
__decorate([
    Input('zoom')
], PdfViewerComponent.prototype, "zoom", null);
__decorate([
    Input('zoom-scale')
], PdfViewerComponent.prototype, "zoomScale", null);
__decorate([
    Input('rotation')
], PdfViewerComponent.prototype, "rotation", null);
__decorate([
    Input('external-link-target')
], PdfViewerComponent.prototype, "externalLinkTarget", null);
__decorate([
    Input('autoresize')
], PdfViewerComponent.prototype, "autoresize", null);
__decorate([
    Input('fit-to-page')
], PdfViewerComponent.prototype, "fitToPage", null);
__decorate([
    Input('show-borders')
], PdfViewerComponent.prototype, "showBorders", null);
__decorate([
    HostListener('window:resize', [])
], PdfViewerComponent.prototype, "onPageResize", null);
PdfViewerComponent = PdfViewerComponent_1 = __decorate([
    Component({
        selector: 'pdf-viewer',
        template: `
    <div #pdfViewerContainer class="ng2-pdf-viewer-container">
      <div class="pdfViewer"></div>
    </div>
  `,
        styles: [".ng2-pdf-viewer-container{overflow-x:auto;position:relative;height:100%;-webkit-overflow-scrolling:touch}:host ::ng-deep .textLayer{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;opacity:.2;line-height:1}:host ::ng-deep .textLayer>span{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0}:host ::ng-deep .textLayer .highlight{margin:-1px;padding:1px;background-color:#b400aa;border-radius:4px}:host ::ng-deep .textLayer .highlight.begin{border-radius:4px 0 0 4px}:host ::ng-deep .textLayer .highlight.end{border-radius:0 4px 4px 0}:host ::ng-deep .textLayer .highlight.middle{border-radius:0}:host ::ng-deep .textLayer .highlight.selected{background-color:#006400}:host ::ng-deep .textLayer ::-moz-selection{background:#00f}:host ::ng-deep .textLayer ::selection{background:#00f}:host ::ng-deep .textLayer .endOfContent{display:block;position:absolute;left:0;top:100%;right:0;bottom:0;z-index:-1;cursor:default;-webkit-user-select:none;-moz-user-select:none;user-select:none}:host ::ng-deep .textLayer .endOfContent.active{top:0}:host ::ng-deep .annotationLayer section{position:absolute}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.pushButton>a,:host ::ng-deep .annotationLayer .linkAnnotation>a{position:absolute;font-size:1em;top:0;left:0;width:100%;height:100%}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.pushButton>a:hover,:host ::ng-deep .annotationLayer .linkAnnotation>a:hover{opacity:.2;background:#ff0;box-shadow:0 2px 10px #ff0}:host ::ng-deep .annotationLayer .textAnnotation img{position:absolute;cursor:pointer}:host ::ng-deep .annotationLayer .textWidgetAnnotation input,:host ::ng-deep .annotationLayer .textWidgetAnnotation textarea{background-color:rgba(0,54,255,.13);border:1px solid transparent;box-sizing:border-box;font-size:9px;height:100%;margin:0;padding:0 3px;vertical-align:top;width:100%}:host ::ng-deep .annotationLayer .choiceWidgetAnnotation select{background-color:rgba(0,54,255,.13);border:1px solid transparent;box-sizing:border-box;font-size:9px;height:100%;margin:0;padding:0 3px;vertical-align:top;width:100%}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input,:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input{background-color:rgba(0,54,255,.13);border:1px solid transparent;box-sizing:border-box;font-size:9px;height:100%;margin:0;vertical-align:top;width:100%}:host ::ng-deep .annotationLayer .choiceWidgetAnnotation select option{padding:0}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input{border-radius:50%}:host ::ng-deep .annotationLayer .textWidgetAnnotation textarea{font:message-box;font-size:9px;resize:none}:host ::ng-deep .annotationLayer .textWidgetAnnotation input[disabled],:host ::ng-deep .annotationLayer .textWidgetAnnotation textarea[disabled]{background:0 0;border:1px solid transparent;cursor:not-allowed}:host ::ng-deep .annotationLayer .choiceWidgetAnnotation select[disabled]{background:0 0;border:1px solid transparent;cursor:not-allowed}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input[disabled],:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input[disabled]{background:0 0;border:1px solid transparent;cursor:not-allowed}:host ::ng-deep .annotationLayer .textWidgetAnnotation input:hover,:host ::ng-deep .annotationLayer .textWidgetAnnotation textarea:hover{border:1px solid #000}:host ::ng-deep .annotationLayer .choiceWidgetAnnotation select:hover{border:1px solid #000}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input:hover,:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input:hover{border:1px solid #000}:host ::ng-deep .annotationLayer .textWidgetAnnotation input:focus,:host ::ng-deep .annotationLayer .textWidgetAnnotation textarea:focus{background:0 0;border:1px solid transparent}:host ::ng-deep .annotationLayer .choiceWidgetAnnotation select:focus{background:0 0;border:1px solid transparent}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input:checked:after,:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input:checked:before{background-color:#000;content:\"\";display:block;position:absolute;height:80%;left:45%;width:1px}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input:checked:before{background-color:#000;content:\"\";display:block;position:absolute;border-radius:50%;height:50%;left:30%;top:20%;width:50%}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input:checked:before{transform:rotate(45deg)}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input:checked:after{transform:rotate(-45deg)}:host ::ng-deep .annotationLayer .textWidgetAnnotation input.comb{font-family:monospace;padding-left:2px;padding-right:0}:host ::ng-deep .annotationLayer .textWidgetAnnotation input.comb:focus{width:115%}:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.checkBox input,:host ::ng-deep .annotationLayer .buttonWidgetAnnotation.radioButton input{-webkit-appearance:none;-moz-appearance:none;appearance:none;padding:0}:host ::ng-deep .annotationLayer .popupWrapper{position:absolute;width:20em}:host ::ng-deep .annotationLayer .popup{position:absolute;z-index:200;max-width:20em;background-color:#ff9;box-shadow:0 2px 5px #888;border-radius:2px;padding:6px;margin-left:5px;cursor:pointer;font:message-box;font-size:9px;word-wrap:break-word}:host ::ng-deep .annotationLayer .popup>*{font-size:9px}:host ::ng-deep .annotationLayer .popup h1{display:inline-block}:host ::ng-deep .annotationLayer .popup span{display:inline-block;margin-left:5px}:host ::ng-deep .annotationLayer .popup p{border-top:1px solid #333;margin-top:2px;padding-top:2px}:host ::ng-deep .annotationLayer .caretAnnotation,:host ::ng-deep .annotationLayer .circleAnnotation svg ellipse,:host ::ng-deep .annotationLayer .fileAttachmentAnnotation,:host ::ng-deep .annotationLayer .freeTextAnnotation,:host ::ng-deep .annotationLayer .highlightAnnotation,:host ::ng-deep .annotationLayer .inkAnnotation svg polyline,:host ::ng-deep .annotationLayer .lineAnnotation svg line,:host ::ng-deep .annotationLayer .polygonAnnotation svg polygon,:host ::ng-deep .annotationLayer .polylineAnnotation svg polyline,:host ::ng-deep .annotationLayer .squareAnnotation svg rect,:host ::ng-deep .annotationLayer .squigglyAnnotation,:host ::ng-deep .annotationLayer .stampAnnotation,:host ::ng-deep .annotationLayer .strikeoutAnnotation,:host ::ng-deep .annotationLayer .underlineAnnotation{cursor:pointer}:host ::ng-deep .pdfViewer{padding-bottom:10px}:host ::ng-deep .pdfViewer .canvasWrapper{overflow:hidden}:host ::ng-deep .pdfViewer .page{direction:ltr;width:816px;height:1056px;margin:1px auto -8px;position:relative;overflow:visible;border:9px solid rgba(0,0,0,.01);box-sizing:initial;background-clip:content-box;-o-border-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAQAAADYWf5HAAAA6UlEQVR4Xl2Pi2rEMAwE16fm1f7/r14v7w4rI0IzLAF7hLxNevBSEMEF5+OilNCsRd8ZMyn+a4NmsOT8WJw1lFbSYgGFzF2bLFoLjTClWjKKGRWpDYAGXUnZ4uhbBUzF3Oe/GG/ue2fn4GgsyXhNgysV2JnrhKEMg4fEZcALmiKbNhBBRFpSyDOj1G4QOVly6O1FV54ZZq8OVygrciDt6JazRgi1ljTPH0gbrPmHPXAbCiDd4GawIjip1TPh9tt2sz24qaCjr/jAb/GBFTbq9KZ7Ke/Cqt8nayUikZKsWZK7Fe6bg5dOUt8fZHWG2BHc+6EAAAAASUVORK5CYII=) 9 9 repeat;border-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAQAAADYWf5HAAAA6UlEQVR4Xl2Pi2rEMAwE16fm1f7/r14v7w4rI0IzLAF7hLxNevBSEMEF5+OilNCsRd8ZMyn+a4NmsOT8WJw1lFbSYgGFzF2bLFoLjTClWjKKGRWpDYAGXUnZ4uhbBUzF3Oe/GG/ue2fn4GgsyXhNgysV2JnrhKEMg4fEZcALmiKbNhBBRFpSyDOj1G4QOVly6O1FV54ZZq8OVygrciDt6JazRgi1ljTPH0gbrPmHPXAbCiDd4GawIjip1TPh9tt2sz24qaCjr/jAb/GBFTbq9KZ7Ke/Cqt8nayUikZKsWZK7Fe6bg5dOUt8fZHWG2BHc+6EAAAAASUVORK5CYII=) 9 9 repeat;background-color:#fff}:host ::ng-deep .pdfViewer.removePageBorders .page{margin:0 auto 10px;border:none}:host ::ng-deep .pdfViewer.removePageBorders{padding-bottom:0}:host ::ng-deep .pdfViewer.singlePageView{display:inline-block}:host ::ng-deep .pdfViewer.singlePageView .page{margin:0;border:none}:host ::ng-deep .pdfViewer.scrollHorizontal,:host ::ng-deep .pdfViewer.scrollWrapped{margin-left:3.5px;margin-right:3.5px;text-align:center}:host ::ng-deep .spread{margin-left:3.5px;margin-right:3.5px;text-align:center}:host ::ng-deep .pdfViewer.scrollHorizontal,:host ::ng-deep .spread{white-space:nowrap}:host ::ng-deep .pdfViewer.removePageBorders,:host ::ng-deep .pdfViewer.scrollHorizontal .spread,:host ::ng-deep .pdfViewer.scrollWrapped .spread{margin-left:0;margin-right:0}:host ::ng-deep .spread .page{display:inline-block;vertical-align:middle;margin-left:-3.5px;margin-right:-3.5px}:host ::ng-deep .pdfViewer.scrollHorizontal .page,:host ::ng-deep .pdfViewer.scrollHorizontal .spread,:host ::ng-deep .pdfViewer.scrollWrapped .page,:host ::ng-deep .pdfViewer.scrollWrapped .spread{display:inline-block;vertical-align:middle}:host ::ng-deep .pdfViewer.scrollHorizontal .page,:host ::ng-deep .pdfViewer.scrollWrapped .page{margin-left:-3.5px;margin-right:-3.5px}:host ::ng-deep .pdfViewer.removePageBorders .spread .page,:host ::ng-deep .pdfViewer.removePageBorders.scrollHorizontal .page,:host ::ng-deep .pdfViewer.removePageBorders.scrollWrapped .page{margin-left:5px;margin-right:5px}:host ::ng-deep .pdfViewer .page canvas{margin:0;display:block}:host ::ng-deep .pdfViewer .page canvas[hidden]{display:none}:host ::ng-deep .pdfViewer .page .loadingIcon{position:absolute;display:block;left:0;top:0;right:0;bottom:0;background:url(data:image/gif;base64,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) center no-repeat}:host ::ng-deep .pdfPresentationMode .pdfViewer{margin-left:0;margin-right:0}:host ::ng-deep .pdfPresentationMode .pdfViewer .page,:host ::ng-deep .pdfPresentationMode .pdfViewer .spread{display:block}:host ::ng-deep .pdfPresentationMode .pdfViewer .page,:host ::ng-deep .pdfPresentationMode .pdfViewer.removePageBorders .page{margin-left:auto;margin-right:auto}:host ::ng-deep .pdfPresentationMode:-webkit-full-screen .pdfViewer .page{margin-bottom:100%;border:0}:host ::ng-deep .pdfPresentationMode:-moz-full-screen .pdfViewer .page,:host ::ng-deep .pdfPresentationMode:-webkit-full-screen .pdfViewer .page,:host ::ng-deep .pdfPresentationMode:fullscreen .pdfViewer .page{margin-bottom:100%;border:0}"]
    })
], PdfViewerComponent);
export { PdfViewerComponent };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGRmLXZpZXdlci5jb21wb25lbnQuanMiLCJzb3VyY2VSb290Ijoibmc6Ly9uZzItcGRmLXZpZXdlci8iLCJzb3VyY2VzIjpbInNyYy9hcHAvcGRmLXZpZXdlci9wZGYtdmlld2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOztHQUVHO0FBQ0gsT0FBTyxFQUNMLFNBQVMsRUFDVCxLQUFLLEVBQ0wsTUFBTSxFQUNOLFVBQVUsRUFDVixZQUFZLEVBQ1osU0FBUyxFQUNULGFBQWEsRUFDYixNQUFNLEVBQ04sWUFBWSxFQUNaLFNBQVMsRUFDVCxTQUFTLEVBQ1QsZ0JBQWdCLEVBQ2pCLE1BQU0sZUFBZSxDQUFDO0FBVXZCLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUUxRCxJQUFJLEtBQVUsQ0FBQztBQUNmLElBQUksV0FBZ0IsQ0FBQztBQUVyQixTQUFTLEtBQUs7SUFDWixPQUFPLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQztBQUN2QyxDQUFDO0FBRUQsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ1osS0FBSyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3hDLFdBQVcsR0FBRyxPQUFPLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUVuRCxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0NBQy9DO0FBRUQsTUFBTSxDQUFOLElBQVksY0FJWDtBQUpELFdBQVksY0FBYztJQUN4QiwyREFBUSxDQUFBO0lBQ1IseURBQU8sQ0FBQTtJQUNQLDJEQUFRLENBQUE7QUFDVixDQUFDLEVBSlcsY0FBYyxLQUFkLGNBQWMsUUFJekI7QUFXRCxJQUFhLGtCQUFrQiwwQkFBL0IsTUFBYSxrQkFBa0I7SUFpTDdCLFlBQW9CLE9BQW1CO1FBQW5CLFlBQU8sR0FBUCxPQUFPLENBQVk7UUE5Sy9CLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFhM0IsY0FBUyxHQUNm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a0JBQWtCLENBOGtCOUI7U0E5a0JZLGtCQUFrQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBDcmVhdGVkIGJ5IHZhZGltZGV6IG9uIDIxLzA2LzE2LlxyXG4gKi9cclxuaW1wb3J0IHtcclxuICBDb21wb25lbnQsXHJcbiAgSW5wdXQsXHJcbiAgT3V0cHV0LFxyXG4gIEVsZW1lbnRSZWYsXHJcbiAgRXZlbnRFbWl0dGVyLFxyXG4gIE9uQ2hhbmdlcyxcclxuICBTaW1wbGVDaGFuZ2VzLFxyXG4gIE9uSW5pdCxcclxuICBIb3N0TGlzdGVuZXIsXHJcbiAgT25EZXN0cm95LFxyXG4gIFZpZXdDaGlsZCxcclxuICBBZnRlclZpZXdDaGVja2VkXHJcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7XHJcbiAgUERGRG9jdW1lbnRQcm94eSxcclxuICBQREZWaWV3ZXJQYXJhbXMsXHJcbiAgUERGUGFnZVByb3h5LFxyXG4gIFBERlNvdXJjZSxcclxuICBQREZQcm9ncmVzc0RhdGEsXHJcbiAgUERGUHJvbWlzZVxyXG59IGZyb20gJ3BkZmpzLWRpc3QnO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRXZlbnRCdXMgfSBmcm9tICcuLi91dGlscy9ldmVudC1idXMtdXRpbHMnO1xyXG5cclxubGV0IFBERkpTOiBhbnk7XHJcbmxldCBQREZKU1ZpZXdlcjogYW55O1xyXG5cclxuZnVuY3Rpb24gaXNTU1IoKSB7XHJcbiAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnO1xyXG59XHJcblxyXG5pZiAoIWlzU1NSKCkpIHtcclxuICBQREZKUyA9IHJlcXVpcmUoJ3BkZmpzLWRpc3QvYnVpbGQvcGRmJyk7XHJcbiAgUERGSlNWaWV3ZXIgPSByZXF1aXJlKCdwZGZqcy1kaXN0L3dlYi9wZGZfdmlld2VyJyk7XHJcblxyXG4gIFBERkpTLnZlcmJvc2l0eSA9IFBERkpTLlZlcmJvc2l0eUxldmVsLkVSUk9SUztcclxufVxyXG5cclxuZXhwb3J0IGVudW0gUmVuZGVyVGV4dE1vZGUge1xyXG4gIERJU0FCTEVELFxyXG4gIEVOQUJMRUQsXHJcbiAgRU5IQU5DRURcclxufVxyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICdwZGYtdmlld2VyJyxcclxuICB0ZW1wbGF0ZTogYFxyXG4gICAgPGRpdiAjcGRmVmlld2VyQ29udGFpbmVyIGNsYXNzPVwibmcyLXBkZi12aWV3ZXItY29udGFpbmVyXCI+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJwZGZWaWV3ZXJcIj48L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIGAsXHJcbiAgc3R5bGVVcmxzOiBbJy4vcGRmLXZpZXdlci5jb21wb25lbnQuc2NzcyddXHJcbn0pXHJcbmV4cG9ydCBjbGFzcyBQZGZWaWV3ZXJDb21wb25lbnRcclxuICBpbXBsZW1lbnRzIE9uQ2hhbmdlcywgT25Jbml0LCBPbkRlc3Ryb3ksIEFmdGVyVmlld0NoZWNrZWQge1xyXG4gIEBWaWV3Q2hpbGQoJ3BkZlZpZXdlckNvbnRhaW5lcicpIHBkZlZpZXdlckNvbnRhaW5lcjtcclxuICBwcml2YXRlIGlzVmlzaWJsZTogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICBzdGF0aWMgQ1NTX1VOSVRTOiBudW1iZXIgPSA5Ni4wIC8gNzIuMDtcclxuICBzdGF0aWMgQk9SREVSX1dJRFRIOiBudW1iZXIgPSA5O1xyXG5cclxuICBwcml2YXRlIHBkZk11bHRpUGFnZVZpZXdlcjogYW55O1xyXG4gIHByaXZhdGUgcGRmTXVsdGlQYWdlTGlua1NlcnZpY2U6IGFueTtcclxuICBwcml2YXRlIHBkZk11bHRpUGFnZUZpbmRDb250cm9sbGVyOiBhbnk7XHJcblxyXG4gIHByaXZhdGUgcGRmU2luZ2xlUGFnZVZpZXdlcjogYW55O1xyXG4gIHByaXZhdGUgcGRmU2luZ2xlUGFnZUxpbmtTZXJ2aWNlOiBhbnk7XHJcbiAgcHJpdmF0ZSBwZGZTaW5nbGVQYWdlRmluZENvbnRyb2xsZXI6IGFueTtcclxuXHJcbiAgcHJpdmF0ZSBfY01hcHNVcmwgPVxyXG4gICAgdHlwZW9mIFBERkpTICE9PSAndW5kZWZpbmVkJ1xyXG4gICAgICA/IGBodHRwczovL3VucGtnLmNvbS9wZGZqcy1kaXN0QCR7KFBERkpTIGFzIGFueSkudmVyc2lvbn0vY21hcHMvYFxyXG4gICAgICA6IG51bGw7XHJcbiAgcHJpdmF0ZSBfcmVuZGVyVGV4dCA9IHRydWU7XHJcbiAgcHJpdmF0ZSBfcmVuZGVyVGV4dE1vZGU6IFJlbmRlclRleHRNb2RlID0gUmVuZGVyVGV4dE1vZGUuRU5BQkxFRDtcclxuICBwcml2YXRlIF9zdGlja1RvUGFnZSA9IGZhbHNlO1xyXG4gIHByaXZhdGUgX29yaWdpbmFsU2l6ZSA9IHRydWU7XHJcbiAgcHJpdmF0ZSBfcGRmOiBQREZEb2N1bWVudFByb3h5O1xyXG4gIHByaXZhdGUgX3BhZ2UgPSAxO1xyXG4gIHByaXZhdGUgX3pvb20gPSAxO1xyXG4gIHByaXZhdGUgX3pvb21TY2FsZTogJ3BhZ2UtaGVpZ2h0J3wncGFnZS1maXQnfCdwYWdlLXdpZHRoJyA9ICdwYWdlLXdpZHRoJztcclxuICBwcml2YXRlIF9yb3RhdGlvbiA9IDA7XHJcbiAgcHJpdmF0ZSBfc2hvd0FsbCA9IHRydWU7XHJcbiAgcHJpdmF0ZSBfY2FuQXV0b1Jlc2l6ZSA9IHRydWU7XHJcbiAgcHJpdmF0ZSBfZml0VG9QYWdlID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBfZXh0ZXJuYWxMaW5rVGFyZ2V0ID0gJ2JsYW5rJztcclxuICBwcml2YXRlIF9zaG93Qm9yZGVycyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgbGFzdExvYWRlZDogc3RyaW5nIHwgVWludDhBcnJheSB8IFBERlNvdXJjZTtcclxuICBwcml2YXRlIF9sYXRlc3RTY3JvbGxlZFBhZ2U6IG51bWJlcjtcclxuXHJcbiAgcHJpdmF0ZSByZXNpemVUaW1lb3V0OiBOb2RlSlMuVGltZXI7XHJcbiAgcHJpdmF0ZSBwYWdlU2Nyb2xsVGltZW91dDogTm9kZUpTLlRpbWVyO1xyXG4gIHByaXZhdGUgaXNJbml0aWFsaXplZCA9IGZhbHNlO1xyXG4gIHByaXZhdGUgbG9hZGluZ1Rhc2s6IGFueTtcclxuXHJcbiAgQE91dHB1dCgnYWZ0ZXItbG9hZC1jb21wbGV0ZScpIGFmdGVyTG9hZENvbXBsZXRlID0gbmV3IEV2ZW50RW1pdHRlcjxcclxuICAgIFBERkRvY3VtZW50UHJveHlcclxuICA+KCk7XHJcbiAgQE91dHB1dCgncGFnZS1yZW5kZXJlZCcpIHBhZ2VSZW5kZXJlZCA9IG5ldyBFdmVudEVtaXR0ZXI8Q3VzdG9tRXZlbnQ+KCk7XHJcbiAgQE91dHB1dCgndGV4dC1sYXllci1yZW5kZXJlZCcpIHRleHRMYXllclJlbmRlcmVkID0gbmV3IEV2ZW50RW1pdHRlcjxcclxuICAgIEN1c3RvbUV2ZW50XHJcbiAgPigpO1xyXG4gIEBPdXRwdXQoJ2Vycm9yJykgb25FcnJvciA9IG5ldyBFdmVudEVtaXR0ZXI8YW55PigpO1xyXG4gIEBPdXRwdXQoJ29uLXByb2dyZXNzJykgb25Qcm9ncmVzcyA9IG5ldyBFdmVudEVtaXR0ZXI8UERGUHJvZ3Jlc3NEYXRhPigpO1xyXG4gIEBPdXRwdXQoKSBwYWdlQ2hhbmdlOiBFdmVudEVtaXR0ZXI8bnVtYmVyPiA9IG5ldyBFdmVudEVtaXR0ZXI8bnVtYmVyPih0cnVlKTtcclxuICBASW5wdXQoKVxyXG4gIHNyYzogc3RyaW5nIHwgVWludDhBcnJheSB8IFBERlNvdXJjZTtcclxuXHJcbiAgQElucHV0KCdjLW1hcHMtdXJsJylcclxuICBzZXQgY01hcHNVcmwoY01hcHNVcmw6IHN0cmluZykge1xyXG4gICAgdGhpcy5fY01hcHNVcmwgPSBjTWFwc1VybDtcclxuICB9XHJcblxyXG4gQElucHV0KCdwYWdlJylcclxuICBzZXQgcGFnZShfcGFnZSkge1xyXG4gICAgX3BhZ2UgPSBwYXJzZUludChfcGFnZSwgMTApIHx8IDE7XHJcbiAgICBjb25zdCBvcmdpbmFsUGFnZSA9IF9wYWdlO1xyXG5cclxuICAgIGlmICh0aGlzLl9wZGYpIHtcclxuICAgICAgX3BhZ2UgPSB0aGlzLmdldFZhbGlkUGFnZU51bWJlcihfcGFnZSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fcGFnZSA9IF9wYWdlO1xyXG4gICAgaWYgKG9yZ2luYWxQYWdlICE9PSBfcGFnZSkge1xyXG4gICAgICB0aGlzLnBhZ2VDaGFuZ2UuZW1pdChfcGFnZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBASW5wdXQoJ3JlbmRlci10ZXh0JylcclxuICBzZXQgcmVuZGVyVGV4dChyZW5kZXJUZXh0OiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9yZW5kZXJUZXh0ID0gcmVuZGVyVGV4dDtcclxuICB9XHJcblxyXG4gIEBJbnB1dCgncmVuZGVyLXRleHQtbW9kZScpXHJcbiAgc2V0IHJlbmRlclRleHRNb2RlKHJlbmRlclRleHRNb2RlOiBSZW5kZXJUZXh0TW9kZSkge1xyXG4gICAgdGhpcy5fcmVuZGVyVGV4dE1vZGUgPSByZW5kZXJUZXh0TW9kZTtcclxuICB9XHJcblxyXG4gIEBJbnB1dCgnb3JpZ2luYWwtc2l6ZScpXHJcbiAgc2V0IG9yaWdpbmFsU2l6ZShvcmlnaW5hbFNpemU6IGJvb2xlYW4pIHtcclxuICAgIHRoaXMuX29yaWdpbmFsU2l6ZSA9IG9yaWdpbmFsU2l6ZTtcclxuICB9XHJcblxyXG4gIEBJbnB1dCgnc2hvdy1hbGwnKVxyXG4gIHNldCBzaG93QWxsKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9zaG93QWxsID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBASW5wdXQoJ3N0aWNrLXRvLXBhZ2UnKVxyXG4gIHNldCBzdGlja1RvUGFnZSh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgdGhpcy5fc3RpY2tUb1BhZ2UgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIEBJbnB1dCgnem9vbScpXHJcbiAgc2V0IHpvb20odmFsdWU6IG51bWJlcikge1xyXG4gICAgaWYgKHZhbHVlIDw9IDApIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3pvb20gPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIGdldCB6b29tKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX3pvb207XHJcbiAgfVxyXG5cclxuICBASW5wdXQoJ3pvb20tc2NhbGUnKVxyXG4gIHNldCB6b29tU2NhbGUodmFsdWU6ICdwYWdlLWhlaWdodCd8J3BhZ2UtZml0JyB8ICdwYWdlLXdpZHRoJykge1xyXG4gICAgdGhpcy5fem9vbVNjYWxlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBnZXQgem9vbVNjYWxlKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX3pvb21TY2FsZTtcclxuICB9XHJcblxyXG4gIEBJbnB1dCgncm90YXRpb24nKVxyXG4gIHNldCByb3RhdGlvbih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICBpZiAoISh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgOTAgPT09IDApKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignSW52YWxpZCBwYWdlcyByb3RhdGlvbiBhbmdsZS4nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3JvdGF0aW9uID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBASW5wdXQoJ2V4dGVybmFsLWxpbmstdGFyZ2V0JylcclxuICBzZXQgZXh0ZXJuYWxMaW5rVGFyZ2V0KHZhbHVlOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuX2V4dGVybmFsTGlua1RhcmdldCA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgQElucHV0KCdhdXRvcmVzaXplJylcclxuICBzZXQgYXV0b3Jlc2l6ZSh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgdGhpcy5fY2FuQXV0b1Jlc2l6ZSA9IEJvb2xlYW4odmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgQElucHV0KCdmaXQtdG8tcGFnZScpXHJcbiAgc2V0IGZpdFRvUGFnZSh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgdGhpcy5fZml0VG9QYWdlID0gQm9vbGVhbih2YWx1ZSk7XHJcbiAgfVxyXG5cclxuICBASW5wdXQoJ3Nob3ctYm9yZGVycycpXHJcbiAgc2V0IHNob3dCb3JkZXJzKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9zaG93Qm9yZGVycyA9IEJvb2xlYW4odmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgc3RhdGljIGdldExpbmtUYXJnZXQodHlwZTogc3RyaW5nKSB7XHJcbiAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgY2FzZSAnYmxhbmsnOlxyXG4gICAgICAgIHJldHVybiAoPGFueT5QREZKUykuTGlua1RhcmdldC5CTEFOSztcclxuICAgICAgY2FzZSAnbm9uZSc6XHJcbiAgICAgICAgcmV0dXJuICg8YW55PlBERkpTKS5MaW5rVGFyZ2V0Lk5PTkU7XHJcbiAgICAgIGNhc2UgJ3NlbGYnOlxyXG4gICAgICAgIHJldHVybiAoPGFueT5QREZKUykuTGlua1RhcmdldC5TRUxGO1xyXG4gICAgICBjYXNlICdwYXJlbnQnOlxyXG4gICAgICAgIHJldHVybiAoPGFueT5QREZKUykuTGlua1RhcmdldC5QQVJFTlQ7XHJcbiAgICAgIGNhc2UgJ3RvcCc6XHJcbiAgICAgICAgcmV0dXJuICg8YW55PlBERkpTKS5MaW5rVGFyZ2V0LlRPUDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBzZXRFeHRlcm5hbExpbmtUYXJnZXQodHlwZTogc3RyaW5nKSB7XHJcbiAgICBjb25zdCBsaW5rVGFyZ2V0ID0gUGRmVmlld2VyQ29tcG9uZW50LmdldExpbmtUYXJnZXQodHlwZSk7XHJcblxyXG4gICAgaWYgKGxpbmtUYXJnZXQgIT09IG51bGwpIHtcclxuICAgICAgKDxhbnk+UERGSlMpLmV4dGVybmFsTGlua1RhcmdldCA9IGxpbmtUYXJnZXQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGVsZW1lbnQ6IEVsZW1lbnRSZWYpIHtcclxuICAgIGlmIChpc1NTUigpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcGRmV29ya2VyU3JjOiBzdHJpbmc7XHJcblxyXG4gICAgaWYgKFxyXG4gICAgICB3aW5kb3cuaGFzT3duUHJvcGVydHkoJ3BkZldvcmtlclNyYycpICYmXHJcbiAgICAgIHR5cGVvZiAod2luZG93IGFzIGFueSkucGRmV29ya2VyU3JjID09PSAnc3RyaW5nJyAmJlxyXG4gICAgICAod2luZG93IGFzIGFueSkucGRmV29ya2VyU3JjXHJcbiAgICApIHtcclxuICAgICAgcGRmV29ya2VyU3JjID0gKHdpbmRvdyBhcyBhbnkpLnBkZldvcmtlclNyYztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHBkZldvcmtlclNyYyA9IGBodHRwczovL2NkbmpzLmNsb3VkZmxhcmUuY29tL2FqYXgvbGlicy9wZGYuanMvJHtcclxuICAgICAgICAoUERGSlMgYXMgYW55KS52ZXJzaW9uXHJcbiAgICAgIH0vcGRmLndvcmtlci5taW4uanNgO1xyXG4gICAgfVxyXG5cclxuICAgIChQREZKUyBhcyBhbnkpLkdsb2JhbFdvcmtlck9wdGlvbnMud29ya2VyU3JjID0gcGRmV29ya2VyU3JjO1xyXG4gIH1cclxuXHJcbiAgbmdBZnRlclZpZXdDaGVja2VkKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaXNJbml0aWFsaXplZCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5wZGZWaWV3ZXJDb250YWluZXIubmF0aXZlRWxlbWVudC5vZmZzZXRQYXJlbnQ7XHJcblxyXG4gICAgaWYgKHRoaXMuaXNWaXNpYmxlID09PSB0cnVlICYmIG9mZnNldCA9PSBudWxsKSB7XHJcbiAgICAgIHRoaXMuaXNWaXNpYmxlID0gZmFsc2U7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pc1Zpc2libGUgPT09IGZhbHNlICYmIG9mZnNldCAhPSBudWxsKSB7XHJcbiAgICAgIHRoaXMuaXNWaXNpYmxlID0gdHJ1ZTtcclxuXHJcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubmdPbkluaXQoKTtcclxuICAgICAgICB0aGlzLm5nT25DaGFuZ2VzKHsgc3JjOiB0aGlzLnNyYyB9IGFzIGFueSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmdPbkluaXQoKSB7XHJcbiAgICBpZiAoIWlzU1NSKCkgJiYgdGhpcy5pc1Zpc2libGUpIHtcclxuICAgICAgdGhpcy5pc0luaXRpYWxpemVkID0gdHJ1ZTtcclxuICAgICAgdGhpcy5zZXR1cE11bHRpUGFnZVZpZXdlcigpO1xyXG4gICAgICB0aGlzLnNldHVwU2luZ2xlUGFnZVZpZXdlcigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmdPbkRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLmNsZWFyKCk7XHJcbiAgfVxyXG5cclxuICBASG9zdExpc3RlbmVyKCd3aW5kb3c6cmVzaXplJywgW10pXHJcbiAgcHVibGljIG9uUGFnZVJlc2l6ZSgpIHtcclxuICAgIGlmICghdGhpcy5fY2FuQXV0b1Jlc2l6ZSB8fCAhdGhpcy5fcGRmKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5yZXNpemVUaW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnJlc2l6ZVRpbWVvdXQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVzaXplVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICB0aGlzLnVwZGF0ZVNpemUoKTtcclxuICAgIH0sIDEwMCk7XHJcbiAgfVxyXG5cclxuICBnZXQgcGRmTGlua1NlcnZpY2UoKTogYW55IHtcclxuICAgIHJldHVybiB0aGlzLl9zaG93QWxsXHJcbiAgICAgID8gdGhpcy5wZGZNdWx0aVBhZ2VMaW5rU2VydmljZVxyXG4gICAgICA6IHRoaXMucGRmU2luZ2xlUGFnZUxpbmtTZXJ2aWNlO1xyXG4gIH1cclxuXHJcbiAgZ2V0IHBkZlZpZXdlcigpOiBhbnkge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0Q3VycmVudFZpZXdlcigpO1xyXG4gIH1cclxuXHJcbiAgZ2V0IHBkZkZpbmRDb250cm9sbGVyKCk6IGFueSB7XHJcbiAgICByZXR1cm4gdGhpcy5fc2hvd0FsbFxyXG4gICAgICA/IHRoaXMucGRmTXVsdGlQYWdlRmluZENvbnRyb2xsZXJcclxuICAgICAgOiB0aGlzLnBkZlNpbmdsZVBhZ2VGaW5kQ29udHJvbGxlcjtcclxuICB9XHJcblxyXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpIHtcclxuICAgIGlmIChpc1NTUigpIHx8ICF0aGlzLmlzVmlzaWJsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCdzcmMnIGluIGNoYW5nZXMpIHtcclxuICAgICAgdGhpcy5sb2FkUERGKCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BkZikge1xyXG4gICAgICBpZiAoJ3JlbmRlclRleHQnIGluIGNoYW5nZXMpIHtcclxuICAgICAgICB0aGlzLmdldEN1cnJlbnRWaWV3ZXIoKS50ZXh0TGF5ZXJNb2RlID0gdGhpcy5fcmVuZGVyVGV4dFxyXG4gICAgICAgICAgPyB0aGlzLl9yZW5kZXJUZXh0TW9kZVxyXG4gICAgICAgICAgOiBSZW5kZXJUZXh0TW9kZS5ESVNBQkxFRDtcclxuICAgICAgICB0aGlzLnJlc2V0UGRmRG9jdW1lbnQoKTtcclxuICAgICAgfSBlbHNlIGlmICgnc2hvd0FsbCcgaW4gY2hhbmdlcykge1xyXG4gICAgICAgIHRoaXMucmVzZXRQZGZEb2N1bWVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICgncGFnZScgaW4gY2hhbmdlcykge1xyXG4gICAgICAgIGlmIChjaGFuZ2VzWydwYWdlJ10uY3VycmVudFZhbHVlID09PSB0aGlzLl9sYXRlc3RTY3JvbGxlZFBhZ2UpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5ldyBmb3JtIG9mIHBhZ2UgY2hhbmdpbmc6IFRoZSB2aWV3ZXIgd2lsbCBub3cganVtcCB0byB0aGUgc3BlY2lmaWVkIHBhZ2Ugd2hlbiBpdCBpcyBjaGFuZ2VkLlxyXG4gICAgICAgIC8vIFRoaXMgYmVoYXZpb3IgaXMgaW50cm9kdWNlZGJ5IHVzaW5nIHRoZSBQREZTaW5nbGVQYWdlVmlld2VyXHJcbiAgICAgICAgdGhpcy5nZXRDdXJyZW50Vmlld2VyKCkuc2Nyb2xsUGFnZUludG9WaWV3KHsgcGFnZU51bWJlcjogdGhpcy5fcGFnZSB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy51cGRhdGUoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGVTaXplKCkge1xyXG4gICAgY29uc3QgY3VycmVudFZpZXdlciA9IHRoaXMuZ2V0Q3VycmVudFZpZXdlcigpO1xyXG4gICAgdGhpcy5fcGRmXHJcbiAgICAgIC5nZXRQYWdlKGN1cnJlbnRWaWV3ZXIuY3VycmVudFBhZ2VOdW1iZXIpXHJcbiAgICAgIC50aGVuKChwYWdlOiBQREZQYWdlUHJveHkpID0+IHtcclxuICAgICAgICBjb25zdCByb3RhdGlvbiA9IHRoaXMuX3JvdGF0aW9uIHx8IHBhZ2Uucm90YXRlO1xyXG4gICAgICAgIGNvbnN0IHZpZXdwb3J0V2lkdGggPVxyXG4gICAgICAgICAgKHBhZ2UgYXMgYW55KS5nZXRWaWV3cG9ydCh7XHJcbiAgICAgICAgICAgIHNjYWxlOiB0aGlzLl96b29tLFxyXG4gICAgICAgICAgICByb3RhdGlvblxyXG4gICAgICAgICAgfSkud2lkdGggKiBQZGZWaWV3ZXJDb21wb25lbnQuQ1NTX1VOSVRTO1xyXG4gICAgICAgIGxldCBzY2FsZSA9IHRoaXMuX3pvb207XHJcbiAgICAgICAgbGV0IHN0aWNrVG9QYWdlID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgLy8gU2NhbGUgdGhlIGRvY3VtZW50IHdoZW4gaXQgc2hvdWxkbid0IGJlIGluIG9yaWdpbmFsIHNpemUgb3IgZG9lc24ndCBmaXQgaW50byB0aGUgdmlld3BvcnRcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAhdGhpcy5fb3JpZ2luYWxTaXplIHx8XHJcbiAgICAgICAgICAodGhpcy5fZml0VG9QYWdlICYmXHJcbiAgICAgICAgICAgIHZpZXdwb3J0V2lkdGggPiB0aGlzLnBkZlZpZXdlckNvbnRhaW5lci5uYXRpdmVFbGVtZW50LmNsaWVudFdpZHRoKVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgY29uc3Qgdmlld1BvcnQgPSAocGFnZSBhcyBhbnkpLmdldFZpZXdwb3J0KHsgc2NhbGU6IDEsIHJvdGF0aW9uIH0pO1xyXG4gICAgICAgICAgc2NhbGUgPSB0aGlzLmdldFNjYWxlKHZpZXdQb3J0LndpZHRoLCB2aWV3UG9ydC5oZWlnaHQpO1xyXG4gICAgICAgICAgc3RpY2tUb1BhZ2UgPSAhdGhpcy5fc3RpY2tUb1BhZ2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjdXJyZW50Vmlld2VyLl9zZXRTY2FsZShzY2FsZSwgc3RpY2tUb1BhZ2UpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjbGVhcigpIHtcclxuICAgIGlmICh0aGlzLmxvYWRpbmdUYXNrICYmICF0aGlzLmxvYWRpbmdUYXNrLmRlc3Ryb3llZCkge1xyXG4gICAgICB0aGlzLmxvYWRpbmdUYXNrLmRlc3Ryb3koKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5fcGRmKSB7XHJcbiAgICAgIHRoaXMuX3BkZi5kZXN0cm95KCk7XHJcbiAgICAgIHRoaXMuX3BkZiA9IG51bGw7XHJcbiAgICAgIHRoaXMucGRmTXVsdGlQYWdlVmlld2VyLnNldERvY3VtZW50KG51bGwpO1xyXG4gICAgICB0aGlzLnBkZlNpbmdsZVBhZ2VWaWV3ZXIuc2V0RG9jdW1lbnQobnVsbCk7XHJcblxyXG4gICAgICB0aGlzLnBkZk11bHRpUGFnZUxpbmtTZXJ2aWNlLnNldERvY3VtZW50KG51bGwsIG51bGwpO1xyXG4gICAgICB0aGlzLnBkZlNpbmdsZVBhZ2VMaW5rU2VydmljZS5zZXREb2N1bWVudChudWxsLCBudWxsKTtcclxuXHJcbiAgICAgIHRoaXMucGRmTXVsdGlQYWdlRmluZENvbnRyb2xsZXIuc2V0RG9jdW1lbnQobnVsbCk7XHJcbiAgICAgIHRoaXMucGRmU2luZ2xlUGFnZUZpbmRDb250cm9sbGVyLnNldERvY3VtZW50KG51bGwpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXR1cE11bHRpUGFnZVZpZXdlcigpIHtcclxuICAgIChQREZKUyBhcyBhbnkpLmRpc2FibGVUZXh0TGF5ZXIgPSAhdGhpcy5fcmVuZGVyVGV4dDtcclxuXHJcbiAgICBQZGZWaWV3ZXJDb21wb25lbnQuc2V0RXh0ZXJuYWxMaW5rVGFyZ2V0KHRoaXMuX2V4dGVybmFsTGlua1RhcmdldCk7XHJcblxyXG4gICAgY29uc3QgZXZlbnRCdXMgPSBjcmVhdGVFdmVudEJ1cyhQREZKU1ZpZXdlcik7XHJcblxyXG4gICAgZXZlbnRCdXMub24oJ3BhZ2VyZW5kZXJlZCcsIGUgPT4ge1xyXG4gICAgICB0aGlzLnBhZ2VSZW5kZXJlZC5lbWl0KGUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZXZlbnRCdXMub24oJ3BhZ2VjaGFuZ2luZycsIGUgPT4ge1xyXG4gICAgICBpZiAodGhpcy5wYWdlU2Nyb2xsVGltZW91dCkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnBhZ2VTY3JvbGxUaW1lb3V0KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5wYWdlU2Nyb2xsVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuX2xhdGVzdFNjcm9sbGVkUGFnZSA9IGUucGFnZU51bWJlcjtcclxuICAgICAgICB0aGlzLnBhZ2VDaGFuZ2UuZW1pdChlLnBhZ2VOdW1iZXIpO1xyXG4gICAgICB9LCAxMDApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZXZlbnRCdXMub24oJ3RleHRsYXllcnJlbmRlcmVkJywgZSA9PiB7XHJcbiAgICAgIHRoaXMudGV4dExheWVyUmVuZGVyZWQuZW1pdChlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucGRmTXVsdGlQYWdlTGlua1NlcnZpY2UgPSBuZXcgUERGSlNWaWV3ZXIuUERGTGlua1NlcnZpY2UoeyBldmVudEJ1cyB9KTtcclxuICAgIHRoaXMucGRmTXVsdGlQYWdlRmluZENvbnRyb2xsZXIgPSBuZXcgUERGSlNWaWV3ZXIuUERGRmluZENvbnRyb2xsZXIoe1xyXG4gICAgICBsaW5rU2VydmljZTogdGhpcy5wZGZNdWx0aVBhZ2VMaW5rU2VydmljZSxcclxuICAgICAgZXZlbnRCdXNcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHBkZk9wdGlvbnM6IFBERlZpZXdlclBhcmFtcyB8IGFueSA9IHtcclxuICAgICAgZXZlbnRCdXM6IGV2ZW50QnVzLFxyXG4gICAgICBjb250YWluZXI6IHRoaXMuZWxlbWVudC5uYXRpdmVFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ2RpdicpLFxyXG4gICAgICByZW1vdmVQYWdlQm9yZGVyczogIXRoaXMuX3Nob3dCb3JkZXJzLFxyXG4gICAgICBsaW5rU2VydmljZTogdGhpcy5wZGZNdWx0aVBhZ2VMaW5rU2VydmljZSxcclxuICAgICAgdGV4dExheWVyTW9kZTogdGhpcy5fcmVuZGVyVGV4dFxyXG4gICAgICAgID8gdGhpcy5fcmVuZGVyVGV4dE1vZGVcclxuICAgICAgICA6IFJlbmRlclRleHRNb2RlLkRJU0FCTEVELFxyXG4gICAgICBmaW5kQ29udHJvbGxlcjogdGhpcy5wZGZNdWx0aVBhZ2VGaW5kQ29udHJvbGxlclxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLnBkZk11bHRpUGFnZVZpZXdlciA9IG5ldyBQREZKU1ZpZXdlci5QREZWaWV3ZXIocGRmT3B0aW9ucyk7XHJcbiAgICB0aGlzLnBkZk11bHRpUGFnZUxpbmtTZXJ2aWNlLnNldFZpZXdlcih0aGlzLnBkZk11bHRpUGFnZVZpZXdlcik7XHJcbiAgICB0aGlzLnBkZk11bHRpUGFnZUZpbmRDb250cm9sbGVyLnNldERvY3VtZW50KHRoaXMuX3BkZik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldHVwU2luZ2xlUGFnZVZpZXdlcigpIHtcclxuICAgIChQREZKUyBhcyBhbnkpLmRpc2FibGVUZXh0TGF5ZXIgPSAhdGhpcy5fcmVuZGVyVGV4dDtcclxuXHJcbiAgICBQZGZWaWV3ZXJDb21wb25lbnQuc2V0RXh0ZXJuYWxMaW5rVGFyZ2V0KHRoaXMuX2V4dGVybmFsTGlua1RhcmdldCk7XHJcblxyXG4gICAgY29uc3QgZXZlbnRCdXMgPSBjcmVhdGVFdmVudEJ1cyhQREZKU1ZpZXdlcik7XHJcblxyXG4gICAgZXZlbnRCdXMub24oJ3BhZ2VjaGFuZ2luZycsIGUgPT4ge1xyXG4gICAgICBpZiAoZS5wYWdlTnVtYmVyICE9IHRoaXMuX3BhZ2UpIHtcclxuICAgICAgICB0aGlzLnBhZ2UgPSBlLnBhZ2VOdW1iZXI7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGV2ZW50QnVzLm9uKCdwYWdlcmVuZGVyZWQnLCBlID0+IHtcclxuICAgICAgdGhpcy5wYWdlUmVuZGVyZWQuZW1pdChlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGV2ZW50QnVzLm9uKCd0ZXh0bGF5ZXJyZW5kZXJlZCcsIGUgPT4ge1xyXG4gICAgICB0aGlzLnRleHRMYXllclJlbmRlcmVkLmVtaXQoZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnBkZlNpbmdsZVBhZ2VMaW5rU2VydmljZSA9IG5ldyBQREZKU1ZpZXdlci5QREZMaW5rU2VydmljZSh7XHJcbiAgICAgIGV2ZW50QnVzXHJcbiAgICB9KTtcclxuICAgIHRoaXMucGRmU2luZ2xlUGFnZUZpbmRDb250cm9sbGVyID0gbmV3IFBERkpTVmlld2VyLlBERkZpbmRDb250cm9sbGVyKHtcclxuICAgICAgbGlua1NlcnZpY2U6IHRoaXMucGRmU2luZ2xlUGFnZUxpbmtTZXJ2aWNlLFxyXG4gICAgICBldmVudEJ1c1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcGRmT3B0aW9uczogUERGVmlld2VyUGFyYW1zIHwgYW55ID0ge1xyXG4gICAgICBldmVudEJ1czogZXZlbnRCdXMsXHJcbiAgICAgIGNvbnRhaW5lcjogdGhpcy5lbGVtZW50Lm5hdGl2ZUVsZW1lbnQucXVlcnlTZWxlY3RvcignZGl2JyksXHJcbiAgICAgIHJlbW92ZVBhZ2VCb3JkZXJzOiAhdGhpcy5fc2hvd0JvcmRlcnMsXHJcbiAgICAgIGxpbmtTZXJ2aWNlOiB0aGlzLnBkZlNpbmdsZVBhZ2VMaW5rU2VydmljZSxcclxuICAgICAgdGV4dExheWVyTW9kZTogdGhpcy5fcmVuZGVyVGV4dFxyXG4gICAgICAgID8gdGhpcy5fcmVuZGVyVGV4dE1vZGVcclxuICAgICAgICA6IFJlbmRlclRleHRNb2RlLkRJU0FCTEVELFxyXG4gICAgICBmaW5kQ29udHJvbGxlcjogdGhpcy5wZGZTaW5nbGVQYWdlRmluZENvbnRyb2xsZXJcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5wZGZTaW5nbGVQYWdlVmlld2VyID0gbmV3IFBERkpTVmlld2VyLlBERlNpbmdsZVBhZ2VWaWV3ZXIocGRmT3B0aW9ucyk7XHJcbiAgICB0aGlzLnBkZlNpbmdsZVBhZ2VMaW5rU2VydmljZS5zZXRWaWV3ZXIodGhpcy5wZGZTaW5nbGVQYWdlVmlld2VyKTtcclxuICAgIHRoaXMucGRmU2luZ2xlUGFnZUZpbmRDb250cm9sbGVyLnNldERvY3VtZW50KHRoaXMuX3BkZik7XHJcblxyXG4gICAgdGhpcy5wZGZTaW5nbGVQYWdlVmlld2VyLl9jdXJyZW50UGFnZU51bWJlciA9IHRoaXMuX3BhZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFZhbGlkUGFnZU51bWJlcihwYWdlOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgaWYgKHBhZ2UgPCAxKSB7XHJcbiAgICAgIHJldHVybiAxO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChwYWdlID4gdGhpcy5fcGRmLm51bVBhZ2VzKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9wZGYubnVtUGFnZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHBhZ2U7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldERvY3VtZW50UGFyYW1zKCkge1xyXG4gICAgY29uc3Qgc3JjVHlwZSA9IHR5cGVvZiB0aGlzLnNyYztcclxuXHJcbiAgICBpZiAoIXRoaXMuX2NNYXBzVXJsKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnNyYztcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwYXJhbXM6IGFueSA9IHtcclxuICAgICAgY01hcFVybDogdGhpcy5fY01hcHNVcmwsXHJcbiAgICAgIGNNYXBQYWNrZWQ6IHRydWVcclxuICAgIH07XHJcblxyXG4gICAgaWYgKHNyY1R5cGUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHBhcmFtcy51cmwgPSB0aGlzLnNyYztcclxuICAgIH0gZWxzZSBpZiAoc3JjVHlwZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgaWYgKCh0aGlzLnNyYyBhcyBhbnkpLmJ5dGVMZW5ndGggIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHBhcmFtcy5kYXRhID0gdGhpcy5zcmM7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgT2JqZWN0LmFzc2lnbihwYXJhbXMsIHRoaXMuc3JjKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwYXJhbXM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRQREYoKSB7XHJcbiAgICBpZiAoIXRoaXMuc3JjKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5sYXN0TG9hZGVkID09PSB0aGlzLnNyYykge1xyXG4gICAgICB0aGlzLnVwZGF0ZSgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jbGVhcigpO1xyXG5cclxuICAgIHRoaXMubG9hZGluZ1Rhc2sgPSAoUERGSlMgYXMgYW55KS5nZXREb2N1bWVudCh0aGlzLmdldERvY3VtZW50UGFyYW1zKCkpO1xyXG5cclxuICAgIHRoaXMubG9hZGluZ1Rhc2sub25Qcm9ncmVzcyA9IChwcm9ncmVzc0RhdGE6IFBERlByb2dyZXNzRGF0YSkgPT4ge1xyXG4gICAgICB0aGlzLm9uUHJvZ3Jlc3MuZW1pdChwcm9ncmVzc0RhdGEpO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBzcmMgPSB0aGlzLnNyYztcclxuICAgICg8UERGUHJvbWlzZTxQREZEb2N1bWVudFByb3h5Pj50aGlzLmxvYWRpbmdUYXNrLnByb21pc2UpLnRoZW4oXHJcbiAgICAgIChwZGY6IFBERkRvY3VtZW50UHJveHkpID0+IHtcclxuICAgICAgICB0aGlzLl9wZGYgPSBwZGY7XHJcbiAgICAgICAgdGhpcy5sYXN0TG9hZGVkID0gc3JjO1xyXG5cclxuICAgICAgICB0aGlzLmFmdGVyTG9hZENvbXBsZXRlLmVtaXQocGRmKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLnBkZk11bHRpUGFnZVZpZXdlcikge1xyXG4gICAgICAgICAgdGhpcy5zZXR1cE11bHRpUGFnZVZpZXdlcigpO1xyXG4gICAgICAgICAgdGhpcy5zZXR1cFNpbmdsZVBhZ2VWaWV3ZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucmVzZXRQZGZEb2N1bWVudCgpO1xyXG5cclxuICAgICAgICB0aGlzLnVwZGF0ZSgpO1xyXG4gICAgICB9LFxyXG4gICAgICAoZXJyb3I6IGFueSkgPT4ge1xyXG4gICAgICAgIHRoaXMub25FcnJvci5lbWl0KGVycm9yKTtcclxuICAgICAgfVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXBkYXRlKCkge1xyXG4gICAgdGhpcy5wYWdlID0gdGhpcy5fcGFnZTtcclxuXHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXIoKSB7XHJcbiAgICB0aGlzLl9wYWdlID0gdGhpcy5nZXRWYWxpZFBhZ2VOdW1iZXIodGhpcy5fcGFnZSk7XHJcbiAgICBjb25zdCBjdXJyZW50Vmlld2VyID0gdGhpcy5nZXRDdXJyZW50Vmlld2VyKCk7XHJcblxyXG4gICAgaWYgKFxyXG4gICAgICB0aGlzLl9yb3RhdGlvbiAhPT0gMCB8fFxyXG4gICAgICBjdXJyZW50Vmlld2VyLnBhZ2VzUm90YXRpb24gIT09IHRoaXMuX3JvdGF0aW9uXHJcbiAgICApIHtcclxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgY3VycmVudFZpZXdlci5wYWdlc1JvdGF0aW9uID0gdGhpcy5fcm90YXRpb247XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLl9zdGlja1RvUGFnZSkge1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICBjdXJyZW50Vmlld2VyLmN1cnJlbnRQYWdlTnVtYmVyID0gdGhpcy5fcGFnZTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy51cGRhdGVTaXplKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFNjYWxlKHZpZXdwb3J0V2lkdGg6IG51bWJlciwgdmlld3BvcnRIZWlnaHQ6IG51bWJlcikge1xyXG4gICAgY29uc3QgYm9yZGVyU2l6ZSA9ICh0aGlzLl9zaG93Qm9yZGVycyA/IDIgKiBQZGZWaWV3ZXJDb21wb25lbnQuQk9SREVSX1dJRFRIIDogMCk7XHJcbiAgICBjb25zdCBwZGZDb250YWluZXJXaWR0aCA9IHRoaXMucGRmVmlld2VyQ29udGFpbmVyLm5hdGl2ZUVsZW1lbnQuY2xpZW50V2lkdGggLSBib3JkZXJTaXplO1xyXG4gICAgY29uc3QgcGRmQ29udGFpbmVySGVpZ2h0ID0gdGhpcy5wZGZWaWV3ZXJDb250YWluZXIubmF0aXZlRWxlbWVudC5jbGllbnRIZWlnaHQgLSBib3JkZXJTaXplO1xyXG5cclxuICAgIGlmIChwZGZDb250YWluZXJIZWlnaHQgPT09IDAgfHwgdmlld3BvcnRIZWlnaHQgPT09IDAgfHwgcGRmQ29udGFpbmVyV2lkdGggPT09IDAgfHwgdmlld3BvcnRXaWR0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gMTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcmF0aW8gPSAxO1xyXG4gICAgc3dpdGNoICh0aGlzLl96b29tU2NhbGUpIHtcclxuICAgICAgY2FzZSAncGFnZS1maXQnOlxyXG4gICAgICAgIHJhdGlvID0gTWF0aC5taW4oKHBkZkNvbnRhaW5lckhlaWdodCAvIHZpZXdwb3J0SGVpZ2h0KSwgKHBkZkNvbnRhaW5lcldpZHRoIC8gdmlld3BvcnRXaWR0aCkpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdwYWdlLWhlaWdodCc6XHJcbiAgICAgICAgcmF0aW8gPSAocGRmQ29udGFpbmVySGVpZ2h0IC8gdmlld3BvcnRIZWlnaHQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdwYWdlLXdpZHRoJzpcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByYXRpbyA9IChwZGZDb250YWluZXJXaWR0aCAvIHZpZXdwb3J0V2lkdGgpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAodGhpcy5fem9vbSAqIHJhdGlvKSAvIFBkZlZpZXdlckNvbXBvbmVudC5DU1NfVU5JVFM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEN1cnJlbnRWaWV3ZXIoKTogYW55IHtcclxuICAgIHJldHVybiB0aGlzLl9zaG93QWxsID8gdGhpcy5wZGZNdWx0aVBhZ2VWaWV3ZXIgOiB0aGlzLnBkZlNpbmdsZVBhZ2VWaWV3ZXI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlc2V0UGRmRG9jdW1lbnQoKSB7XHJcbiAgICB0aGlzLnBkZkZpbmRDb250cm9sbGVyLnNldERvY3VtZW50KHRoaXMuX3BkZik7XHJcblxyXG4gICAgaWYgKHRoaXMuX3Nob3dBbGwpIHtcclxuICAgICAgdGhpcy5wZGZTaW5nbGVQYWdlVmlld2VyLnNldERvY3VtZW50KG51bGwpO1xyXG4gICAgICB0aGlzLnBkZlNpbmdsZVBhZ2VMaW5rU2VydmljZS5zZXREb2N1bWVudChudWxsKTtcclxuXHJcbiAgICAgIHRoaXMucGRmTXVsdGlQYWdlVmlld2VyLnNldERvY3VtZW50KHRoaXMuX3BkZik7XHJcbiAgICAgIHRoaXMucGRmTXVsdGlQYWdlTGlua1NlcnZpY2Uuc2V0RG9jdW1lbnQodGhpcy5fcGRmLCBudWxsKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMucGRmTXVsdGlQYWdlVmlld2VyLnNldERvY3VtZW50KG51bGwpO1xyXG4gICAgICB0aGlzLnBkZk11bHRpUGFnZUxpbmtTZXJ2aWNlLnNldERvY3VtZW50KG51bGwpO1xyXG5cclxuICAgICAgdGhpcy5wZGZTaW5nbGVQYWdlVmlld2VyLnNldERvY3VtZW50KHRoaXMuX3BkZik7XHJcbiAgICAgIHRoaXMucGRmU2luZ2xlUGFnZUxpbmtTZXJ2aWNlLnNldERvY3VtZW50KHRoaXMuX3BkZiwgbnVsbCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==