// Ablak Canvas Kezelő Modul
// Ez a modul az ablakok vizuális megjelenítését kezeli a Fabric.js canvas segítségével.
// Hasonló funkcionalitást biztosít, mint a beltéri ajtó és villanyóra szekrény ajtó canvas modulok.

// Globális változók
var windowCanvas = null;
var windowPanelData = {};
var windowPanelMenu = null;

// Z-index értékek definiálása globálisan
var windowZIndexes = {
    background: 0,    // Háttér
    glassArea: 2,     // Üvegtabla területek
    frieze: 3,        // Frízek
    frame: 10,        // Keret
    sash: 20,         // Szárny
    division: 30,     // Osztók
    csapos: 40,       // Csapos elemek
    panel: 1000       // Panelek - sokkal magasabb érték, hogy biztos a legfelül legyenek
};

/**
 * Inicializálja az ablak canvast és a kapcsolódó eseménykezelőket
 */
function initWindowCanvas() {
    console.log("Ablak canvas inicializálása...");

    // Csak egyszer inicializáljuk a canvast, ha már létezik, akkor csak frissítjük
    if (!windowCanvas) {
        // Ellenőrizzük, hogy létezik-e a window-canvas elem, ha nem, akkor létrehozzuk
        var canvasContainer = document.querySelector('.tab.active .canvas-container');
        if (!canvasContainer) {
            // Ha nincs canvas-container, akkor keressük az aktív tab-ot
            canvasContainer = document.querySelector('#windowTab');
            if (!canvasContainer) {
                console.error("Nem található canvas container vagy windowTab!");
                return;
            }
            // Létrehozunk benne egy canvas-container div-et
            var containerDiv = document.createElement('div');
            containerDiv.className = 'canvas-container';
            canvasContainer.appendChild(containerDiv);
            canvasContainer = containerDiv;
        }

        // Ellenőrizzük, hogy van-e már canvas elem
        var existingCanvas = canvasContainer.querySelector('canvas#window-canvas');
        if (!existingCanvas) {
            // Ha nincs, létrehozunk egy új canvas elemet
            existingCanvas = document.createElement('canvas');
            existingCanvas.id = 'window-canvas';
            existingCanvas.width = 600;
            existingCanvas.height = 600;
            canvasContainer.appendChild(existingCanvas);
            console.log("Új ablak canvas elem létrehozva");
        }

        // Canvas inicializálása
        windowCanvas = new fabric.Canvas('window-canvas', {
            width: 600,
            height: 600,
            selection: false,
            hoverCursor: 'pointer',
            backgroundColor: '#f0f0f0',
            renderOnAddRemove: true
        });

        // Létrehozunk egy rejtett elemet windowPreviewCanvas ID-val, hogy a panelHandling.js el tudja érni
        var windowPreviewCanvas = document.getElementById('windowPreviewCanvas');
        if (!windowPreviewCanvas) {
            windowPreviewCanvas = document.createElement('div');
            windowPreviewCanvas.id = 'windowPreviewCanvas';
            windowPreviewCanvas.style.display = 'none'; // Elrejtjük, csak referencia céljából van
            document.body.appendChild(windowPreviewCanvas);
            console.log("windowPreviewCanvas segédelem létrehozva");
        }

        // A canvas referenciát elérhetővé tesszük globálisan és a windowPreviewCanvas elemhez is
        window.windowCanvas = windowCanvas;
        windowPreviewCanvas.fabric = windowCanvas;
        console.log("Canvas referencia beállítva a windowPreviewCanvas-hez és globálisan");

        console.log("Canvas méretei: " + windowCanvas.width + "x" + windowCanvas.height);

        // Kikapcsoljuk a control boxokat (a kijelölést jelző téglalapokat)
        windowCanvas.on('selection:created', function(e) {
            if (e.selected && e.selected.length > 0 && e.selected[0].panelId) {
                // Ha panelt választottunk ki, ne töröljük a kijelölést,
                // mivel a panelre kattintáskor meg kell jeleníteni a menüt
                console.log('[DEBUG] Panel kiválasztva a selection eventnél:', e.selected[0].panelId);
            } else {
                // Ha nem panelt választottunk ki, töröljük a kijelölést
                windowCanvas.discardActiveObject();
                windowCanvas.renderAll();
            }
        });

        // Panel kiválasztási eseménykezelő hozzáadása
        windowCanvas.on('mouse:down', function(event) {
            if (event.target && event.target.panelId) {
                console.log("[DEBUG] Panel kiválasztva a selection eventnél:", event.target.panelId);

                // Panel kiválasztása
                window.activePanel = event.target.panelId;
                window.activePanelType = 'window';
            }
        });

        // Panel választó menü eseménykezelés inicializálása
        initWindowPanelMenu();
    } else {
        console.log("A canvas már inicializálva van, csak frissítjük.");

        // Csak akkor próbálunk rajzolni, ha van definiált params paraméter
        // Ez lehetővé teszi a függvény paraméter nélküli hívását is
        if (typeof params !== 'undefined' && params) {
            var dimensions = getDimensions(params);

            // Ablak rajzolás frissítése
            windowCanvas.clear();
            drawWindow(params, dimensions);

            // Panel adatok frissítése a paraméterváltozások alapján
            if (typeof updateAllPanels === 'function') {
                updateAllPanels('window');
            }

            // Méretinformáció frissítése
            updateSizeInfo(params);
        } else {
            console.log("Nincs paraméter megadva, nem frissítjük a rajzot.");
        }
    }

    // Panel adatok inicializálása
    if (!window.windowPanelData) {
        window.windowPanelData = {};
    }

    // Panelek létrehozása csak a drawWindow függvényben fog megtörténni
    // Itt csak inicializáljuk az adatstruktúrákat
    window.windowPanelMatrix = {};

    // Eseményfigyelők hozzáadása az űrlap mezőkhöz, hogy automatikusan frissüljön az előnézet
    // Késleltetjük az eseménykezelők beállítását, hogy biztosan minden DOM elem betöltődjön
    setTimeout(function() {
        setupWindowInputListeners();
        // Kezdeti előnézet frissítése
        updateWindowPreview();
    }, 100);
}

/**
 * Beállítja az eseményfigyelőket az ablak űrlap mezőihez a canvas automatikus frissítéséhez
 */
function setupWindowInputListeners() {
    console.log("%c[ABLAK INIT] Ablak input eseménykezelők beállítása...", "color: blue; font-weight: bold");

    // Megkeressük az összes, ablakhoz kapcsolódó input és select elemet
    // Kibővítjük a keresést, hogy a windowGlass és windowWood prefixű elemeket is megtaláljuk
    var inputs = document.querySelectorAll('input[id^="window_"], select[id^="window_"], input[id^="windowGlass"], input[id^="windowWood"]');

    // Ha nincsenek input mezők, akkor korán visszatérünk
    if (!inputs || inputs.length === 0) {
        console.log("%c[ABLAK HIBA] Nem találhatók ablak input mezők az eseménykezelők beállításához.", "color: red; font-weight: bold");
        return;
    }

    console.log("%c[ABLAK INIT] Talált input mezők száma: " + inputs.length, "color: blue");

    // Kilistázzuk az összes talált input mezőt
    inputs.forEach(function(input, index) {
        console.log(`[ABLAK INIT] Input #${index+1}: id=${input.id}, type=${input.type}, value=${input.value}`);
    });

    // Hozzáadjuk az eseménykezelőket mindegyik elemhez
    inputs.forEach(function(input) {
        // Töröljük a korábbi eseménykezelőket, hogy elkerüljük a duplázást
        input.removeEventListener('change', handleWindowInputChange);
        input.removeEventListener('input', handleWindowInputChange);

        // FONTOS: Közvetlenül az eseménykezelő függvényt adjuk át, ne anonim függvényt használjunk
        // Ez biztosítja, hogy a removeEventListener működik
        input.addEventListener('change', handleWindowInputChange);

        // Valós idejű frissítés számok és csúszkák esetén
        if (input.type === 'number' || input.type === 'range') {
            input.addEventListener('input', handleWindowInputChange);
        }

        // Extra naplózás a hibakereséshez
        console.log(`[ABLAK INIT] Eseménykezelő hozzáadva: ${input.id}`);
    });

    // Hogyha van generáló gomb, arra is tegyünk eseménykezelőt
    var generateButton = document.getElementById('generate-window-button');
    if (generateButton) {
        generateButton.removeEventListener('click', handleWindowInputChange);
        generateButton.addEventListener('click', handleWindowInputChange);
        console.log("%c[ABLAK INIT] Generáló gomb eseménykezelő beállítva", "color: blue");
    }

    // Kezdeti előnézet frissítése
    console.log("%c[ABLAK INIT] Kezdeti előnézet frissítése...", "color: blue");
    updateWindowPreview();

    console.log("%c[ABLAK INIT] Ablak input mezők figyelése sikeresen beállítva. Talált input elemek száma: " + inputs.length, "color: blue; font-weight: bold");
}

/**
 * Eseménykezelő függvény az ablak input mezők változásához
 */
function handleWindowInputChange(event) {
    // Kiemelt logüzenetek a könnyebb nyomonkövetésért
    console.log("%c[ABLAK INPUT] Ablak beállítás változott:", "color: green; font-weight: bold", {
        id: event.target ? event.target.id : 'ismeretlen',
        type: event.target ? event.target.type : 'ismeretlen',
        value: event.target ? event.target.value : 'ismeretlen',
        timestamp: new Date().toISOString()
    });

    // FONTOS: Csökkentjük a késleltetést, hogy gyorsabban frissülön a canvas
    // Szám típusú input mezőknél és csúszkáknál azonnal frissítsünk
    var isNumberInput = event.target && (event.target.type === 'number' || event.target.type === 'range');
    var delay = isNumberInput && event.type === 'input' ? 0 : 100;

    // Töröljük a korábbi időzítést, ha van
    if (window.windowUpdateTimeout) {
        clearTimeout(window.windowUpdateTimeout);
    }

    // Új időzítés beállítása
    window.windowUpdateTimeout = setTimeout(function() {
        console.log("%c[ABLAK PARAM] Paraméterek lekérése...", "color: purple");

        try {
            // Az aktuális paraméterek lekérése az űrlapból
            if (typeof getWindowParams === 'function') {
                console.log("%c[ABLAK PARAM] getWindowParams függvény elérhető, használjuk azt", "color: purple");
                var params = getWindowParams(); // A getWindowParams függvényt a dialog.html definiálja

                if (params) {
                    console.log("%c[ABLAK PARAM] Új ablak paraméterek:", "color: purple; font-weight: bold", params);
                    console.log("%c[ABLAK PARAM] Szélesség:", "color: purple", params.width);
                    console.log("%c[ABLAK PARAM] Magasság:", "color: purple", params.height);

                    // Canvas előnézet frissítése az új paraméterekkel
                    console.log("%c[ABLAK RAJZ] Canvas frissítése a paraméterekkel...", "color: orange");
                    drawWindow(params);

                    // Frissített paraméterek mentése a globális változóba
                    window.currentWindowParams = params;
                    console.log("%c[ABLAK PARAM] Paraméterek elmentve a globális változóba", "color: purple");
                    return; // Sikeres frissítés, kilépünk
                } else {
                    console.warn("%c[ABLAK HIBA] Nem sikerült lekérni az ablak paramétereket", "color: red");
                }
            } else {
                console.warn("%c[ABLAK HIBA] A getWindowParams függvény nem található!", "color: red");
            }

            // Ha ide jutottunk, akkor a getWindowParams nem működött megfelelően
            // Próbáljuk meg közvetlenül frissíteni az előnézetet
            console.log("%c[ABLAK FALLBACK] Alternatív módszerrel frissítjük az előnézetet...", "color: orange");
            updateWindowPreview();

        } catch (error) {
            // Hiba esetén is próbáljuk meg frissíteni az előnézetet
            console.error("%c[ABLAK HIBA] Hiba történt a paraméterek feldolgozása közben:", "color: red", error);
            updateWindowPreview();
        }
    }, delay); // Csökkentett késleltetés a gyorsabb frissítésért
}

/**
 * Init függvény a panel választó menühöz
 */
function initWindowPanelMenu() {
    // Panel kattíntás esemény kezelése - Most már a közös handleCanvasClick függvényt használjuk
    windowCanvas.on('mouse:down', function(options) {
        if (options.target && options.target.panelId) {
            console.log('[DEBUG] Ablak panel kiválasztva:', options.target.panelId);

            // Ellenőrizzük, hogy elérhető-e a handleCanvasClick függvény
            if (typeof window.handleCanvasClick === 'function') {
                // Meghívjuk a közös panel kezelő függvényt 'window' típussal
                window.handleCanvasClick(windowCanvas, options, 'window');
                console.log('[DEBUG] Közös handleCanvasClick függvény meghívva window típussal');
                return;
            } else {
                console.warn('[DEBUG] A handleCanvasClick függvény nem érhető el globálisan! Manuális kezelés szükséges.');
            }

            // Fallback: ha a közös függvény nem elérhető, akkor a régi módon kezeljük
            window.activePanel = options.target.panelId;
            window.activePanelType = 'window'; // Fontos a közös rendszer számára

            // Pozicionáljuk és megjelenítjük a panel választó menüt
            var panelSelector = document.getElementById('panel-selector');
            if (panelSelector) {
                panelSelector.style.display = 'block';
                panelSelector.style.left = options.e.pageX + 'px';
                panelSelector.style.top = options.e.pageY + 'px';

                // Beállítjuk a panel gombokat a window típushoz
                if (typeof window.setupPanelButtons === 'function') {
                    window.setupPanelButtons('window');
                }

                // Frissítjük az aktuális panel típus információt
                var panelInfo = document.getElementById('panel-info');
                if (panelInfo) {
                    // Ellenőrizzük, hogy megjelenjen a helyes típus
                    var panel = windowPanelData[options.target.panelId];
                    var panelType = 'uveg';
                    if (window.windowPanelMatrix && window.windowPanelMatrix[options.target.panelId]) {
                        panelType = window.windowPanelMatrix[options.target.panelId].type === 'glass' ? 'uveg' : 'fa';
                    } else if (panel) {
                        panelType = panel.type === 'glass' ? 'uveg' : 'fa';
                    }

                    panelInfo.textContent = "Kiválasztott panel: " + (panel ? panel.row : '?') + ". sor, " +
                        (panel ? panel.col : '?') + ". oszlop" +
                        " - Jelenlegi típus: " + (panelType === 'uveg' ? 'Üveg' : 'Fa betét');
                }
            }
        }
    });

    console.log("Ablak panel menü inicializálva");
}

/**
 * Beállítja az eseménykezelőket az ablak input mezőihez
 */
function setupWindowInputEventHandlers() {
    // Megkeressük az összes, ablakhoz kapcsolódó input és select elemet
    // Ezek előtagjéban mindig window_ vagy window- szerepel
    var inputs = document.querySelectorAll('input[id^="window_"], select[id^="window_"], input[id^="window-"], select[id^="window-"]');

    // Hozzáadjuk az eseménykezelőket mindegyik elemhez
    inputs.forEach(function(input) {
        // Input mezők változásánál mentjük a beállításokat
        input.addEventListener('change', function() {
            console.log('Ablak beállítás változott:', this.id);
            if (typeof saveWindowSettings === 'function') {
                saveWindowSettings();
            }
        });
    });

    // Keressük meg az ablakhoz kapcsolódó generáló gombot
    var generateButtons = document.querySelectorAll('button[id^="generate-window"], button[id*="window"]');
    generateButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            console.log('Ablak generálás gomb megnyomva');
            if (typeof saveWindowSettings === 'function') {
                saveWindowSettings();
            }
        });
    });

    console.log('Ablak eseménykezelők beállítva, talált input elemek száma:', inputs.length);
}

/**
 * Frissíti az ablak panel vizuális megjelenítését
 * @param {string} panelId - A panel azonosítója
 * @param {string} panelType - A panel típusa ('glass' vagy 'wood')
 */
function updateWindowPanelVisuals(panelId, panelType) {
    console.log("Panel vizuális frissítése:", panelId, panelType);

    // Ellenőrizzük, hogy a panel létezik-e a saját rendszerünkben
    var panelObj = windowPanelData[panelId];
    if (!panelObj || !panelObj.fabricObject) {
        console.log('[HIBA] Panel objektum nem található a windowPanelData-ban:', panelId);
        return;
    }

    // Ellenőrizzük, hogy a panel létezik-e a közös rendszerben
    if (!window.windowPanelMatrix || !window.windowPanelMatrix[panelId]) {
        console.log('[HIBA] Panel objektum nem található a windowPanelMatrix-ban:', panelId);
        return;
    }

    // Normál formára konvertáljuk a panel típust
    var normalizedType = panelType.toLowerCase();
    if (normalizedType === 'wood' || normalizedType === 'fa') {
        normalizedType = 'wood';
    } else if (normalizedType === 'glass' || normalizedType === 'uveg') {
        normalizedType = 'glass';
    }

    // Frissítjük a panel típusát a saját rendszerünkben
    panelObj.type = normalizedType;

    // Frissítjük a panel típusát a közös rendszerben is
    window.windowPanelMatrix[panelId].type = normalizedType;
    console.log('[DEBUG] windowPanelMatrix['+panelId+']:', window.windowPanelMatrix[panelId]);

    // Túlónyúlás és vastagság értékek bekérése a globális változókból
    var overlap = 0;
    var thickness = 0;

    if (normalizedType === 'wood') {
        // Fa panel esetén a fa túlónyúlás és vastagság értékeket használjuk
        overlap = window.windowWoodOverlap || 5; // Alapértelmezett 5mm, ha nincs beállítva
        thickness = window.windowWoodThickness || 20; // Alapértelmezett 20mm

        // Beállítjuk a közös rendszerben is
        window.windowPanelMatrix[panelId].thickness = thickness;
        window.windowPanelMatrix[panelId].overlap = overlap;
    } else if (normalizedType === 'glass') {
        // Üveg panel esetén az üveg túlónyúlás és vastagság értékeket használjuk
        overlap = window.windowGlassOverlap || 5; // Alapértelmezett 5mm, ha nincs beállítva
        thickness = window.windowGlassThickness || 4; // Alapértelmezett 4mm

        // Beállítjuk a közös rendszerben is
        window.windowPanelMatrix[panelId].thickness = thickness;
        window.windowPanelMatrix[panelId].overlap = overlap;
    }

    console.log('[DEBUG] Panel túlónyúlás:', overlap, 'mm, Vastagság:', thickness, 'mm');

    // Panel vizuális megjelenítés frissítése a típus alapján
    var fabricObj = panelObj.fabricObject;

    // Túlnyúlás számítása - a villanyóra szekrény modulból átvett logika
    // Konverziós faktor számítása - az ablak szélessége alapján
    // A canvas mérete és az ablak valós mérete közötti arány
    var canvasWidth = windowCanvas.width;
    var windowWidth = 900; // Alapértelmezett ablak szélesség mm-ben
    if (window.currentWindowParams && window.currentWindowParams.width) {
        windowWidth = window.currentWindowParams.width;
    }
    var conversionFactor = canvasWidth / windowWidth;

    // Túlónyúlás pixelértéke
    var overlapPx = overlap * conversionFactor;

    // Eredeti panel adatok
    var originalLeft = panelObj.left;
    var originalTop = panelObj.top;
    var originalWidth = panelObj.width;
    var originalHeight = panelObj.height;

    // Szín beállítása típus alapján
    var fillColor, strokeColor, opacity;

    if (normalizedType === 'wood') {
        fillColor = '#a86d3b';  // Fa szín
        strokeColor = '#805533';
        opacity = 1.0;
    } else if (normalizedType === 'glass') {
        fillColor = '#a5d1e1';  // Üveg szín (világos kékés)
        strokeColor = '#85a5b1';
        opacity = 0.7;  // Kicsit átlátszó
    } else {
        fillColor = '#202530';  // Sötét szürke
        strokeColor = '#777777';
        opacity = 1.0;
    }

    // Panel újrarajzolása a túlnyúlással
    fabricObj.set({
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: 1,
        opacity: opacity,
        left: originalLeft - overlapPx,
        top: originalTop - overlapPx,
        width: originalWidth + (overlapPx * 2),
        height: originalHeight + (overlapPx * 2),
        zIndex: windowZIndexes.panel  // Sokkal magasabb z-index érték (1000)
    });

    // Mentés a panel adatokba
    saveWindowPanelData();

    // Panel előre hozása a bringToFront metódussal
    try {
        // Próbáljuk a bringToFront metódust használni
        if (typeof fabricObj.bringToFront === 'function') {
            fabricObj.bringToFront();
            console.log('[DEBUG] Panel előre hozva (bringToFront):', panelId);
        } else if (typeof fabricObj.moveTo === 'function') {
            var objCount = windowCanvas.getObjects().length;
            fabricObj.moveTo(objCount - 1);
            console.log('[DEBUG] Panel előre hozva (moveTo):', panelId);
        } else {
            // Ha egyik metódus sem elérhető, akkor eltávolítjuk és újra hozzáadjuk
            windowCanvas.remove(fabricObj);
            windowCanvas.add(fabricObj);
            console.log('[DEBUG] Panel eltávolítva és újra hozzáadva a canvas-hez:', panelId);
        }
    } catch (error) {
        console.error("Hiba történt a panel előre hozása közben:", error);
    }

    // Canvas frissítése
    windowCanvas.renderAll();
    console.log('[DEBUG] Panel vizualizáció frissítve:', panelId, 'típus:', normalizedType);
}

/**
 * Panel adatok mentése, hogy később fel tudjuk használni a SketchUp komponens generáláshoz
 */
function saveWindowPanelData() {
    // Csak a panel típusokát mentjük le (fa/üveg), a méreteket a Ruby oldal számolja
    var panels = [];

    for (var panelId in windowPanelData) {
        var panel = windowPanelData[panelId];

        // Panel típusától függő értékek
        var isGlass = panel.type === 'glass';
        var thickness = isGlass ? window.glassThickness || panel.thickness : window.woodThickness || panel.thickness;
        var overlap = isGlass ? window.glassOverlap || 5 : window.woodOverlap || 5;

        // Hozzáadjuk a panel adatokat - csak az azonosítókat és típusokat, a méreteket a Ruby számolja
        panels.push({
            id: panelId,
            row: panel.row,
            col: panel.col,
            wing: panel.wing, // Kétszárnyú ablaknál szükséges
            type: panel.type,
            thickness: thickness,
            overlap: overlap,
            isDouble: panel.isDouble || false
        });
    }

    // Elmentjük az adatokat egy rejtett input mezőbe
    var panelDataInput = document.getElementById('window_panel_data');
    if (!panelDataInput) {
        // Ha nem létezik, létrehozzuk
        panelDataInput = document.createElement('input');
        panelDataInput.type = 'hidden';
        panelDataInput.id = 'window_panel_data';
        document.body.appendChild(panelDataInput);
    }

    // Beállítjuk az értéket JSON formátumban
    panelDataInput.value = JSON.stringify(panels);
    console.log('Ablak panel adatok mentve:', panels.length, 'panel');
}

/**
 * Létrehozza a szükséges panel területeket az osztók között
 * @param {Object} params - A fő paraméterek
 * @param {Object} dimensions - Kiszámított méretek
 * @param {Array} horizontalDivisions - Vízszintes osztók adatai
 * @param {Array} verticalDivisions - Függőleges osztók adatai
 * @param {Object} panelDimensions - Ruby oldalról számított panel méretek
 */
function createWindowPanels(params, dimensions, horizontalDivisions, verticalDivisions, panelDimensions) {
    console.log("Ablak panelek létrehozása...", params);

    // Aktuális paraméterek mentése a későbbi frissítésekhez
    window.currentWindowParams = params;
    window.currentWindowDimensions = dimensions;
    window.currentHorizontalDivisions = horizontalDivisions;
    window.currentVerticalDivisions = verticalDivisions;

    // Töröljük a korábbi panel adatokat
    windowPanelData = {};

    // Töröljük és inicializáljuk a panel mátrixot a panelHandling.js számára
    windowPanelMatrix = {}; // Ez a változó elérhető a panelHandling.js-ben

    // Ablak típus meghatározása
    var isMultiSash = params.window_type === 'Kétszárnyú' ||
                       params.window_type === 'Többszárnyú' ||
                       String(params.window_type).toLowerCase().includes("ket") ||
                       String(params.window_type).toLowerCase().includes("tobb") ||
                       params.is_multi_sash === true;

    // Frame szélesség és méretek kiszámítása
    var frameWidth = dimensions.frameWidth || 60;

    // Részletes naplózás a kiindulási paraméterekről
    console.log("%c=== PANEL GENERATION STARTED ====", "color: green; font-weight: bold");
    console.log("Ablak paraméterek:", params);
    console.log("Számított méretek:", dimensions);
    console.log("Vízszintes osztók száma:", horizontalDivisions.length);
    console.log("Függőleges osztók száma:", verticalDivisions.length);
    console.log("Frame szélesség:", frameWidth, "px");
    console.log("Canvas offset: x=", dimensions.offsetX, "px, y=", dimensions.offsetY, "px");

    // Vízszintes szegmensek meghatározása (sorok)
    var rowSegments = [];

    // Első sor - felső csapos és első vízszintes osztó között (vagy az alsó csaposig, ha nincs osztó)
    // Az aktuális csapos szélesség kiszámítása a paraméterekből
    var upperTenonedWidthMm = params.upper_tenoned_width || (dimensions.upperTenonedWidth / dimensions.scale) || (frameWidth / dimensions.scale);
    var upperTenonedWidthPx = upperTenonedWidthMm * dimensions.scale;

    var lowerTenonedWidthMm = params.lower_tenoned_width || (dimensions.lowerTenonedWidth / dimensions.scale) || (frameWidth / dimensions.scale);
    var lowerTenonedWidthPx = lowerTenonedWidthMm * dimensions.scale;

    // Panel pozíció meghatározása a csapos méretek alapján
    var firstRowTop = dimensions.offsetY + upperTenonedWidthPx;

    var firstRowBottom = horizontalDivisions.length > 0
        ? horizontalDivisions[0].y
        : dimensions.offsetY + dimensions.height - lowerTenonedWidthPx;

    console.log("%cCsapos elemek számítás:", "color: #4CAF50; font-weight: bold;",
              "\n   Felső csapos szélesség: " + upperTenonedWidthMm + " mm (" + upperTenonedWidthPx.toFixed(1) + " px)",
              "\n   Alsó csapos szélesség: " + lowerTenonedWidthMm + " mm (" + lowerTenonedWidthPx.toFixed(1) + " px)");

    rowSegments.push({
        top: firstRowTop,
        bottom: firstRowBottom
    });

    // Középső sorok - osztók közötti területek
    for (var i = 0; i < horizontalDivisions.length - 1; i++) {
        var currentDivision = horizontalDivisions[i];
        var nextDivision = horizontalDivisions[i+1];

        rowSegments.push({
            top: currentDivision.y + currentDivision.height,
            bottom: nextDivision.y
        });
    }

    // Utolsó sor - utolsó osztó és alsó csapos között (csak ha van legalább egy osztó)
    if (horizontalDivisions.length > 0) {
        var lastDivision = horizontalDivisions[horizontalDivisions.length - 1];

        // Ezt a részt már nem kell újraszámolni, mivel már kiszámítottuk korábban a pixeles értékeket
        // Ugyanazt a lowerTenonedWidthPx értéket használjuk, amit korábban számoltunk ki

        rowSegments.push({
            top: lastDivision.y + lastDivision.height,
            bottom: dimensions.offsetY + dimensions.height - lowerTenonedWidthPx
        });

        console.log("%cUtolsó sor panel számítás:", "color: #03A9F4; font-weight: bold;",
                  "\n   Utolsó osztó alsó széle: " + (lastDivision.y + lastDivision.height) + " px",
                  "\n   Alsó csapos felső széle: " + (dimensions.offsetY + dimensions.height - lowerTenonedWidthPx) + " px",
                  "\n   Panel magassága: " + ((dimensions.offsetY + dimensions.height - lowerTenonedWidthPx) - (lastDivision.y + lastDivision.height)) + " px");
    }

    // Függőleges szegmensek meghatározása (oszlopok)
    var colSegments = [];

    // Canvas méretei és offset
    var offsetX = dimensions.offsetX;
    var offsetY = dimensions.offsetY;

    if (isMultiSash) {
        console.log("Kétszárnyú ablak paneljeinek létrehozása");

        // Fríz szélesség kiszámítása a kétszárnyú ablakhoz
        var friezeWidthMm = params.frieze_width || (dimensions.friezeWidth / dimensions.scale) || (frameWidth / dimensions.scale);
        var friezeWidthPx = friezeWidthMm * dimensions.scale;

        console.log("%cKétszárnyú ablak fríz számítás:", "color: #FF9800; font-weight: bold;",
                  "\n   Tok anyag szélesség: " + (frameWidth / dimensions.scale).toFixed(1) + " mm (" + frameWidth.toFixed(1) + " px)",
                  "\n   Fríz szélesség: " + friezeWidthMm + " mm (" + friezeWidthPx.toFixed(1) + " px)");

        // Középső osztó pozíciója
        var middleX = offsetX + (dimensions.width / 2);

        // Középen nem egy, hanem két fríz van (egy-egy minden szárnyhoz)
        var middleDivisionWidth = dimensions.middleDivisionWidth || friezeWidthPx;

        // Középső osztó bal és jobb széle, figyelembe véve a két középső frízet
        var middleDivisionLeftX = middleX - friezeWidthPx; // Bal oldali középső fríz bal széle
        var middleDivisionRightX = middleX + friezeWidthPx; // Jobb oldali középső fríz jobb széle

        console.log("%cKözépső osztó és két fríz:", "color: #009688; font-weight: bold;",
                  "\n   Középvonal: " + middleX + " px",
                  "\n   Bal fríz bal széle: " + middleDivisionLeftX + " px",
                  "\n   Jobb fríz jobb széle: " + middleDivisionRightX + " px",
                  "\n   Középső rész szélessége: " + (middleDivisionRightX - middleDivisionLeftX) + " px");

        // Bal szárny belső területe - javított fríz szélességgel
        var leftSashLeft = offsetX + friezeWidthPx;
        var leftSashRight = middleDivisionLeftX;

        // Jobb szárny belső területe - javított fríz szélességgel
        var rightSashLeft = middleDivisionRightX;
        var rightSashRight = offsetX + dimensions.width - friezeWidthPx;

        console.log("Bal szárny terület:", leftSashLeft, "-", leftSashRight);
        console.log("Jobb szárny terület:", rightSashLeft, "-", rightSashRight);

        // Bal szárny osztók szűrése - az isLeftWingDivision tulajdonság alapján
        var leftDivisions = [];
        for (var i = 0; i < verticalDivisions.length; i++) {
            var division = verticalDivisions[i];
            if (division.isLeftWingDivision) {
                leftDivisions.push(division);
            }
        }

        // Jobb szárny osztók szűrése - az isRightWingDivision tulajdonság alapján
        var rightDivisions = [];
        for (var i = 0; i < verticalDivisions.length; i++) {
            var division = verticalDivisions[i];
            if (division.isRightWingDivision) {
                rightDivisions.push(division);
            }
        }

        console.log("Bal szárny osztók:", leftDivisions.length);
        console.log("Jobb szárny osztók:", rightDivisions.length);

        // Bal szárny oszlopai
        // Rendezzük az osztókat x szerint
        leftDivisions.sort(function(a, b) { return a.x - b.x; });

        // Bal szárny első oszlopa (bal széltől az első osztóig vagy a középső osztóig)
        colSegments.push({
            left: leftSashLeft,
            right: leftDivisions.length > 0 ? leftDivisions[0].x : leftSashRight
        });

        // Bal szárny közbenső oszlopai (osztók között)
        for (var i = 0; i < leftDivisions.length - 1; i++) {
            colSegments.push({
                left: leftDivisions[i].x + leftDivisions[i].width,
                right: leftDivisions[i+1].x
            });
        }

        // Bal szárny utolsó oszlopa (utolsó osztótól a középső osztóig)
        if (leftDivisions.length > 0) {
            colSegments.push({
                left: leftDivisions[leftDivisions.length-1].x + leftDivisions[leftDivisions.length-1].width,
                right: leftSashRight
            });
        }

        // Jobb szárny oszlopai
        // Rendezzük az osztókat x szerint
        rightDivisions.sort(function(a, b) { return a.x - b.x; });

        // Jobb szárny első oszlopa (középső osztótól az első osztóig vagy a jobb szélig)
        colSegments.push({
            left: rightSashLeft,
            right: rightDivisions.length > 0 ? rightDivisions[0].x : rightSashRight
        });

        // Jobb szárny közbenső oszlopai (osztók között)
        for (var i = 0; i < rightDivisions.length - 1; i++) {
            colSegments.push({
                left: rightDivisions[i].x + rightDivisions[i].width,
                right: rightDivisions[i+1].x
            });
        }

        // Jobb szárny utolsó oszlopa (utolsó osztótól a jobb szélig)
        if (rightDivisions.length > 0) {
            colSegments.push({
                left: rightDivisions[rightDivisions.length-1].x + rightDivisions[rightDivisions.length-1].width,
                right: rightSashRight
            });
        }
    } else {
        // Egyszárnyú ablak - javított logika a fríz szélesség használatával

        // Fríz szélesség kiszámítása - vagy a paraméterből, vagy a dimenziókból, vagy fallback a frameWidth
        var friezeWidth = (params.frieze_width ? params.frieze_width * dimensions.scale : null) ||
                        dimensions.friezeWidth ||
                        frameWidth;

        console.log("%cPanel keretezés számítás:", "color: #FF9800; font-weight: bold;",
                  "\n   Tok anyag szélesség: " + frameWidth + " px",
                  "\n   Fríz szélesség: " + friezeWidth + " px");

        // Első oszlop - bal fríz és első függőleges osztó között (vagy a jobb frízig, ha nincs osztó)
        var firstColLeft = offsetX + friezeWidth;
        var firstColRight = verticalDivisions.length > 0
            ? verticalDivisions[0].x   // Ez már tartalmazza az offsetX-et
            : offsetX + dimensions.width - friezeWidth;  // Itt explicit hozzáadjuk az offsetX-et

        colSegments.push({
            left: firstColLeft,
            right: firstColRight
        });

        // Középső oszlopok - osztók közötti területek
        for (var i = 0; i < verticalDivisions.length - 1; i++) {
            var currentDivision = verticalDivisions[i];
            var nextDivision = verticalDivisions[i+1];

            colSegments.push({
                left: currentDivision.x + currentDivision.width,
                right: nextDivision.x
            });
        }

        // Utolsó oszlop - utolsó osztó és jobb fríz között (csak ha van legalább egy osztó)
        if (verticalDivisions.length > 0) {
            var lastDivision = verticalDivisions[verticalDivisions.length - 1];

            // A helyes jobboldali él kiszámítása - javított verzió
            // A lastDivision.x már tartalmazza az offsetX-et, így a teljes jobb szélet is ennek figyelembevételével kell kiszámolni
            // A friezeWidth értéket kell használni a frameWidth helyett, hogy konzisztens legyen a bal oldalon alkalmazottal
            var rightEdge = offsetX + dimensions.width - friezeWidth;

            console.log("DEBUG: Jobb panel szélesség vizsgálat:",
                      "left:", lastDivision.x + lastDivision.width,
                      "right:", rightEdge,
                      "szélesség:", rightEdge - (lastDivision.x + lastDivision.width));

            colSegments.push({
                left: lastDivision.x + lastDivision.width,
                right: rightEdge  // Most már helyes lesz, mert a koordináták konzisztensen tartalmazzák az offsetX-et
            });
        }
    }

    // Panelek létrehozása a szegmensekből
    console.log("Panelek létrehozása a szegmensekből");
    console.log("Sorok száma:", rowSegments.length, "Oszlopok száma:", colSegments.length);

    // Panel objektumok tárolása
    var panelObjects = [];

    // Végigmegyünk a sorokon és oszlopokon
    for (var row = 0; row < rowSegments.length; row++) {
        var rowSegment = rowSegments[row];

        for (var col = 0; col < colSegments.length; col++) {
            var colSegment = colSegments[col];

            // Panel azonosító létrehozása (sor_oszlop formátumban)
            var panelId = 'window_' + row + '_' + col;

            // Ellenőrizzük, hogy a panel mérete érvényes-e
            var panelWidth = colSegment.right - colSegment.left;
            var panelHeight = rowSegment.bottom - rowSegment.top;

            if (panelWidth <= 0 || panelHeight <= 0) {
                console.log("Figyelmen kívül hagyott panel érvénytelen méret miatt:", panelId,
                          "Szélesség:", panelWidth, "Magasság:", panelHeight);
                continue;
            }

            // A pixel értékek visszaváltása mm-be a skála alapján
            var widthInMm = Math.round((panelWidth / dimensions.scale) * 10) / 10;
            var heightInMm = Math.round((panelHeight / dimensions.scale) * 10) / 10;
            var leftInMm = Math.round(((colSegment.left - dimensions.offsetX) / dimensions.scale) * 10) / 10;
            var topInMm = Math.round(((rowSegment.top - dimensions.offsetY) / dimensions.scale) * 10) / 10;

            console.log("%c=== PANEL ADATOK ===>", "color: #FF5722; font-weight: bold; font-size: 12px; background-color: #FFFFCC; padding: 3px;");
            console.log("%cPanel azonosító:", "font-weight: bold; color: blue;", panelId);
            console.log("%cPozíció:", "font-weight: bold;", "sor " + row + ", oszlop " + col);
            console.log("%cMÉRETEK:", "color: #FF5722; font-weight: bold;",
                      "\n   Szélesség: " + widthInMm + " mm (" + panelWidth.toFixed(1) + " px)" +
                      "\n   Magasság: " + heightInMm + " mm (" + panelHeight.toFixed(1) + " px)");
            console.log("%cPOZÍCIÓ:", "color: #4CAF50; font-weight: bold;",
                      "\n   Bal: " + leftInMm + " mm" +
                      "\n   Felső: " + topInMm + " mm");
            console.log("%c====================", "color: #FF5722; font-weight: bold; font-size: 12px; background-color: #FFFFCC; padding: 3px;");

            // Ellenőrizzük, hogy a panel méretei pozitívak-e
            if (panelWidth <= 0 || panelHeight <= 0) {
                console.warn("%cFIGYELEM: Érvénytelen panel méretek!", "color: red; font-weight: bold");
            }

            // Panel létrehozása
            var panelRect = new fabric.Rect({
                left: colSegment.left,
                top: rowSegment.top,
                width: panelWidth,
                height: panelHeight,
                fill: '#a5d1e1',  // Alapértelmezett üveg szín
                stroke: '#85a5b1',
                strokeWidth: 1,
                selectable: true,  // Kijelölhetővé tesszük a paneleket
                evented: true,     // Részt vehet eseményekben
                panelId: panelId,  // Hozzáadjuk a panel ID-t az objektumhoz
                doorType: 'window', // Hozzáadjuk az ablak típusát
                zIndex: windowZIndexes.panel // Panelek a legfelül - sokkal magasabb érték (1000)
            });

            // Tároljuk a panel objektumot későbbi hozzáadáshoz
            panelObjects.push({
                panelRect: panelRect,
                panelId: panelId,
                row: row,
                col: col,
                width: panelWidth,
                height: panelHeight,
                left: colSegment.left,
                top: rowSegment.top
            });

            // Tároljuk a panel adatokat a saját rendszerünkben
            windowPanelData[panelId] = {
                row: row,
                col: col,
                type: 'glass', // Alapértelmezett típus: üveg
                width: panelWidth,
                height: panelHeight,
                left: colSegment.left,
                top: rowSegment.top,
                fabricObject: panelRect
            };

            // Tároljuk a panel adatokat a közös panelHandling rendszerben is
            windowPanelMatrix[panelId] = {
                id: panelId,
                row: row,
                col: col,
                type: 'glass', // Alapértelmezett típus: üveg
                thickness: window.windowGlassThickness || 4, // Üveg vastagság
                overlap: window.windowGlassOverlap || 5,     // Üveg túlónyúlás
                width: panelWidth,
                height: panelHeight,
                left: colSegment.left,
                top: rowSegment.top,
                doorType: 'window',
                isMultiSash: isMultiSash
            };
        }
    }

    // Tároljuk a panel adatokat, hogy később fel lehessen használni őket
    saveWindowPanelData();

    // Végül hozzáadjuk a paneleket a canvashoz, hogy biztos a legfelül legyenek
    for (var i = 0; i < panelObjects.length; i++) {
        var panel = panelObjects[i];
        var panelRect = panel.panelRect;
        var panelId = panel.panelId;

        // Hozzáadjuk a panelt a canvas-hez
        windowCanvas.add(panelRect);

        // Beállítjuk a kattintási eseménykezelőt a panel típus váltáshoz
        (function(id) {
            panelRect.on('mousedown', function(e) {
                // Megakadályozzuk, hogy a canvas értelmezze a kattintást
                e.e.stopPropagation();

                // Panel adatok lekérése
                var panel = windowPanelData[id];
                if (!panel) {
                    console.log("[HIBA] Nem található panel adatok:", id);
                    return;
                }

                console.log("Panel kiválasztva:", id);

                // Beállítjuk az aktív panelt a közös rendszerben
                window.activePanel = id;
                window.activePanelType = 'window'; // Fontos a közös rendszer számára

                // Pozicionáljuk és megjelenítjük a panel választó menüt
                var panelSelector = document.getElementById('panel-selector');
                if (panelSelector) {
                    // Megjelenítjük a panel választót
                    panelSelector.style.display = 'block';
                    panelSelector.style.left = e.e.pageX + 'px';
                    panelSelector.style.top = e.e.pageY + 'px';

                    // Frissítjük a panel információs szöveget
                    var panelInfo = document.getElementById('panel-info');
                    if (panelInfo) {
                        // Ellenőrizzük, hogy melyik típus van beállítva
                        var panelType = 'uveg';
                        if (window.windowPanelMatrix && window.windowPanelMatrix[id]) {
                            panelType = window.windowPanelMatrix[id].type === 'glass' ? 'uveg' : 'fa';
                        } else if (panel) {
                            panelType = panel.type === 'glass' ? 'uveg' : 'fa';
                        }

                        // Frissítjük a panel információs szöveget
                        panelInfo.textContent = "Kiválasztott panel: " + panel.row + ". sor, " +
                            panel.col + ". oszlop" +
                            " - Jelenlegi típus: " + (panelType === 'uveg' ? 'Üveg' : 'Fa betét');
                    }
                }
            });
        })(panelId);

        // Próbáljuk a bringToFront metódust használni a panel előre hozásához
        try {
            if (typeof panelRect.bringToFront === 'function') {
                panelRect.bringToFront();
                console.log('[DEBUG] Panel előre hozva (bringToFront):', panelId);
            } else if (typeof panelRect.moveTo === 'function') {
                var objCount = windowCanvas.getObjects().length;
                panelRect.moveTo(objCount - 1);
                console.log('[DEBUG] Panel előre hozva (moveTo):', panelId);
            }
        } catch (error) {
            console.error("Hiba történt a panel előre hozása közben:", error);
        }
    }

    // Frissítjük a canvast, hogy a változások láthatóak legyenek
    windowCanvas.renderAll();
}

/**
 * Panel méretek lekérése a Ruby oldaltól
 * @param {Object} params - Az ablak paraméterei
 * @returns {Promise} - Panel méreteket tartalmazó Promise objektum
 */
function getWindowPanelDimensions(params) {
    return new Promise((resolve, reject) => {
        if (!window.sketchup) {
            console.warn("A SketchUp API nem érhető el!");
            resolve({});
            return;
        }

        try {
            // Beállítjuk a callback funkciót, amit a Ruby meg fog hívni
            window.panelDimensionsCallback = function() {
                resolve(window.panelDimensions || {});
            };

            // Hívjuk a Ruby oldali API-t
            window.sketchup.callback("getWindowPanelDimensions", JSON.stringify(params));
        } catch (error) {
            console.error("Hiba a panel méretek lekérése közben:", error);
            resolve({});
        }
    });
}

/**
 * Kirajzolja az ablakot a megadott paraméterek alapján
 * @param {Object} params - Az ablak paraméterei
 */
function drawWindow(params) {
    console.log("%c[ABLAK RAJZ] Rajzolás indítása...", "color: orange; font-weight: bold");
    console.log("Paraméterek:", params);

    // Canvas inicializálása, ha még nem történt meg
    if (!windowCanvas) {
        initWindowCanvas();
    }

    // Canvas tartalmának törlése
    windowCanvas.clear();
    windowPanelData = {};
    window.windowPanelMatrix = {};

    // Használjuk a globálisan definiált windowZIndexes értékeket

    // Ablak típus ellenőrzése - rugalmasabb ellenőrzés
    console.log("Eredeti window_type paraméter:", params.window_type);

    // Ellenőrizzük a különböző lehetséges formátumokat
    var isMultiSash = params.window_type === "Kétszárnyú" ||
                     params.window_type === "ketszárnyú" ||
                     params.window_type === "ketszárnyu" ||
                     params.window_type === "Kétszárnyu" ||
                     params.window_type === "2" ||
                     params.window_type === 2 ||
                     params.window_type === "dual" ||
                     params.window_type === "double" ||
                     String(params.window_type).toLowerCase().includes("két") ||
                     String(params.window_type).toLowerCase().includes("ket") ||
                     params.is_multi_sash === true ||
                     params.is_dual === true;

    // Aszimmetrikus kétszárnyú ablak paraméterek
    var isAsymmetric = params.is_asymmetric || false;
    var mainWingRatio = isAsymmetric ? (parseInt(params.main_wing_ratio) || 60) : 50;

    console.log("Ablak típus:", params.window_type, "Kétszárnyú:", isMultiSash, "Aszimmetrikus:", isAsymmetric);
    console.log("Fő szárny aránya:", mainWingRatio + "%");

    // Kiszámítjuk a skálázást, hogy az ablak elférjen a canvason
    var canvasWidth = windowCanvas.width;
    var canvasHeight = windowCanvas.height;

    // Biztonsági ellenőrzés a canvas méreteire
    if (!canvasWidth || !canvasHeight) {
        canvasWidth = 600;
        canvasHeight = 600;
        console.log("[ABLAK RAJZ] Figyelmeztetés: Canvas méretek hiányoznak, alapértelmezett 600x600 méret használata.");
    }

    // Biztonsági ellenőrzés a paraméterekre
    if (!params.width || params.width <= 0) params.width = 900;
    if (!params.height || params.height <= 0) params.height = 1500;

    console.log("[ABLAK RAJZ] Canvas méretei: " + canvasWidth + "x" + canvasHeight);
    console.log("[ABLAK RAJZ] Ablak méretei: " + params.width + "x" + params.height + " mm");

    // Kiszámítjuk a skálázást, hogy az ablak elférjen a canvason
    // Hagyjunk egy kis margót a canvas szélén
    var margin = 60; // 30 pixel margó minden oldalon
    var scale = Math.min((canvasWidth - margin) / params.width, (canvasHeight - margin) / params.height);

    console.log("[ABLAK RAJZ] Számított skála: " + scale + " pixel/mm");

    // Offset számítás - középre igazítás
    var offsetX = (canvasWidth - (params.width * scale)) / 2;
    var offsetY = (canvasHeight - (params.height * scale)) / 2;

    console.log("[ABLAK RAJZ] Offset: X=" + offsetX + ", Y=" + offsetY);

    // Kiszámított dimenziók
    var dimensions = {
        scale: scale,
        width: params.width * scale,
        height: params.height * scale,
        frameWidth: (params.frame_wood_width || 60) * scale,
        divisionWidth: (params.division_wood_width || 40) * scale,
        middleDivisionWidth: (params.middle_division_width || 60) * scale,
        offsetX: offsetX,
        offsetY: offsetY,

        // Fríz és csap paraméterek
        friezeWidth: (params.frieze_width || 60) * scale,
        friezeDepth: (params.frieze_depth || 40) * scale,
        tenonLength: (params.tenon_length || 10) * scale,

        // Csapos elemek paraméterei
        upperTenonedWidth: (params.upper_tenoned_width || 60) * scale,
        lowerTenonedWidth: (params.lower_tenoned_width || 60) * scale,
        upperTenonedDepth: (params.upper_tenoned_depth || 40) * scale,
        lowerTenonedDepth: (params.lower_tenoned_depth || 40) * scale,

        // Függőleges osztók paraméterei
        verticalDivisionWidth: (params.vertical_division_width || 40) * scale,
        verticalDivisionDepth: (params.vertical_division_depth || 70) * scale
    };

    // Globális értékek beállítása a későbbi felhasználáshoz
    window.windowGlassThickness = params.glass_thickness || 4;
    window.windowGlassOverlap = params.glass_overlap || 5;
    window.windowWoodThickness = params.wood_thickness || 20;
    window.windowWoodOverlap = params.wood_overlap || 5;

    // Háttér - világos a jobb kontrasztra
    windowCanvas.add(new fabric.Rect({
        left: offsetX,
        top: offsetY,
        width: dimensions.width,
        height: dimensions.height,
        fill: '#3f3f3f',
        stroke: '#888888',
        strokeWidth: 2,
        selectable: false,
        zIndex: windowZIndexes.background
    }));

    // Keret
    windowCanvas.add(new fabric.Rect({
        left: offsetX,
        top: offsetY,
        width: dimensions.width,
        height: dimensions.height,
        fill: '#a88e6c',  // Fa színű
        stroke: '#805533',
        strokeWidth: 1,
        selectable: false
    }));

    // Üvegtabla terület
    if (isMultiSash) {
        // Kétszárnyú ablak - két külön üvegtabla

        // Középső osztó pozíciója - aszimmetrikus kezelés
        var mainWingWidth = isAsymmetric ?
            dimensions.width * (mainWingRatio / 100) :
            dimensions.width / 2;

        var middleX = offsetX + mainWingWidth;
        var middleDivisionLeftX = middleX - (dimensions.middleDivisionWidth / 2);
        var middleDivisionRightX = middleX + (dimensions.middleDivisionWidth / 2);

        console.log("Fő szárny szélessége:", mainWingWidth);

        // Bal szárny üvegtabla - aszimmetrikus kezelés
        var leftSashWidth = mainWingWidth - dimensions.friezeWidth - (dimensions.middleDivisionWidth / 2);
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth,
            top: offsetY + dimensions.upperTenonedWidth,
            width: leftSashWidth,
            height: dimensions.height - dimensions.upperTenonedWidth - dimensions.lowerTenonedWidth,
            fill: '#202530',
            stroke: '#777777',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.glassArea
        }));

        // Jobb szárny üvegtabla - aszimmetrikus kezelés
        var rightSashWidth = dimensions.width - mainWingWidth - dimensions.friezeWidth - (dimensions.middleDivisionWidth / 2);
        windowCanvas.add(new fabric.Rect({
            left: middleDivisionRightX,
            top: offsetY + dimensions.upperTenonedWidth,
            width: rightSashWidth,
            height: dimensions.height - dimensions.upperTenonedWidth - dimensions.lowerTenonedWidth,
            fill: '#202530',
            stroke: '#777777',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.glassArea
        }));

        // Középső osztó
        windowCanvas.add(new fabric.Rect({
            left: middleDivisionLeftX,
            top: offsetY + dimensions.upperTenonedWidth,
            width: dimensions.middleDivisionWidth,
            height: dimensions.height - dimensions.upperTenonedWidth - dimensions.lowerTenonedWidth,
            fill: '#a88e6c',  // Fa színű
            stroke: '#805533',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.division
        }));

        // Középvonal - szaggatott vonal
        windowCanvas.add(new fabric.Line(
            [middleX, offsetY, middleX, offsetY + dimensions.height],
            {
                stroke: '#ffffff',
                strokeWidth: 1,
                strokeDashArray: [5, 5],
                selectable: false
            }
        ));
    } else {
        // Egyszárnyú ablak - egy üvegtabla
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth,
            top: offsetY + dimensions.upperTenonedWidth,
            width: dimensions.width - (dimensions.friezeWidth * 2),
            height: dimensions.height - dimensions.upperTenonedWidth - dimensions.lowerTenonedWidth,
            fill: '#202530',
            stroke: '#777777',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.glassArea
        }));
    }

    // Vízszintes osztók rajzolása
    var horizontalDivisions = [];

    if (params.horizontal_divisions > 0) {
        // Figyelembe vesszük a felső és alsó csapos elemeket
        var availableHeight = dimensions.height - dimensions.upperTenonedWidth - dimensions.lowerTenonedWidth;
        var spacing = availableHeight / (parseInt(params.horizontal_divisions) + 1);

        for (var i = 1; i <= params.horizontal_divisions; i++) {
            var y = offsetY + dimensions.upperTenonedWidth + (spacing * i) - (dimensions.divisionWidth / 2);

            // Vízszintes osztó - világos
            if (isMultiSash) {
                // Kétszárnyú ablakonál két részben rajzoljuk, hogy a középső frízek elmetszék

                // Bal szárny vízszintes osztó
                var leftStart = offsetX + dimensions.friezeWidth;
                var leftEnd = middleDivisionLeftX;
                windowCanvas.add(new fabric.Rect({
                    left: leftStart,
                    top: y,
                    width: leftEnd - leftStart,
                    height: dimensions.divisionWidth,
                    fill: '#a88e6c',
                    stroke: '#805533',
                    strokeWidth: 1,
                    selectable: false,
                    zIndex: windowZIndexes.division
                }));

                // Jobb szárny vízszintes osztó
                var rightStart = middleDivisionRightX;
                var rightEnd = offsetX + dimensions.width - dimensions.friezeWidth;
                windowCanvas.add(new fabric.Rect({
                    left: rightStart,
                    top: y,
                    width: rightEnd - rightStart,
                    height: dimensions.divisionWidth,
                    fill: '#a88e6c',
                    stroke: '#805533',
                    strokeWidth: 1,
                    selectable: false,
                    zIndex: windowZIndexes.division
                }));
            } else {
                // Egyszárnyú ablakonál egy darabban rajzoljuk
                windowCanvas.add(new fabric.Rect({
                    left: offsetX + dimensions.friezeWidth,
                    top: y,
                    width: dimensions.width - (dimensions.friezeWidth * 2),
                    height: dimensions.divisionWidth,
                    fill: '#a88e6c',
                    stroke: '#805533',
                    strokeWidth: 1,
                    selectable: false,
                    zIndex: windowZIndexes.division
                }));
            }

            // Tárolom az osztó pozícióját a panelek létrehozásához
            // FONTOS: y már tartalmazza az offsetY-t, ezért tároljuk a relatív értéket is
            horizontalDivisions.push({
                y: y,
                y_relative: y - offsetY,  // Ez az offset nélküli pozíció
                height: dimensions.divisionWidth
            });
        }
    }

    // Függőleges osztók adatainak összegyűjtése
    var verticalDivisions = [];

    if (params.vertical_divisions > 0) {
        // Kétszárnyú ablak esetén külön kezeljük a bal és jobb oldali osztókat
        if (isMultiSash) {
            console.log("Kétszárnyú ablak osztóinak elhelyezése");

            // Kétszárnyú ablaknál középen két fríz van
            var middleX = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2);

            // Középső frízek helye és szélessége
            var leftWingRightFriezeX = middleX - dimensions.friezeWidth; // Bal szárny jobb fríz kezdete
            var rightWingLeftFriezeX = middleX; // Jobb szárny bal fríz kezdete

            // Bal szárny belső szélessége (a bal fríz és a középső fríz között)
            var leftSashInnerWidth = leftWingRightFriezeX - (offsetX + dimensions.friezeWidth);
            // Jobb szárny belső szélessége (a középső fríztől a jobb frízig)
            var rightSashInnerWidth = (offsetX + dimensions.width - dimensions.friezeWidth) -
                                       (rightWingLeftFriezeX + dimensions.friezeWidth);

            console.log("Bal szárny belső szélessége:", leftSashInnerWidth,
                       "Jobb szárny belső szélessége:", rightSashInnerWidth);

            // Számítsuk ki, hány osztó kerül a bal és jobb szárnyba
            // Aszimmetrikus ablakonál az osztók száma arányos a szárnyak szélességével
            var totalDivisions = parseInt(params.vertical_divisions);

            var leftDivisions, rightDivisions;
            if (isAsymmetric && totalDivisions > 1) {
                // Arányos elosztás a szárnyak szélessége alapján
                leftDivisions = Math.round(totalDivisions * (mainWingRatio / 100));
                rightDivisions = totalDivisions - leftDivisions;

                // Biztosítsuk, hogy minden szárnyban van legalább 1 osztó, ha van osztó egyáltalán
                if (totalDivisions > 0) {
                    if (leftDivisions < 1) leftDivisions = 1;
                    if (rightDivisions < 1) rightDivisions = 1;
                } else {
                    leftDivisions = 0;
                    rightDivisions = 0;
                }
            } else {
                // Kétszárnyú ablaknál, ha van függőleges osztó, akkor minden szárnyba kell legalább egy
                if (totalDivisions > 0) {
                    // Mivel mindkét szárnyba kell legalább egy osztó, ezért először elosztjuk a két szárny között
                    leftDivisions = 1;
                    rightDivisions = 1;

                    // Ha van további osztó, akkor azok egyenlően kerülnek a két szárny közé
                    var remainingDivisions = totalDivisions - 2;
                    if (remainingDivisions > 0) {
                        leftDivisions += Math.ceil(remainingDivisions / 2);
                        rightDivisions += Math.floor(remainingDivisions / 2);
                    }

                    console.log("%c[DEBUG] Kétszárnyú ablaknál mindkét szárnyba kerül osztó", "color: red");
                } else {
                    leftDivisions = 0;
                    rightDivisions = 0;
                }
            }

            console.log("Bal szárny osztók száma:", leftDivisions,
                       "Jobb szárny osztók száma:", rightDivisions);

            // Bal oldali osztók
            if (leftDivisions > 0) {
                // A bal szárny belső szélessége a bal fríz és a középső fríz között
                var leftInnerWidth = leftSashInnerWidth;

                console.log("%cBAL SZÁRNY OSZTÓ SZÁMÍTÁS", "color: red; font-weight: bold");
                console.log("Bal szárny belső szélessége:", (leftInnerWidth / dimensions.scale).toFixed(1), "mm");
                console.log("Osztók száma a bal szárnyban:", leftDivisions);
                console.log("Függőleges osztó szélessége:", (dimensions.verticalDivisionWidth / dimensions.scale).toFixed(1), "mm");

                // Egyszernyi térköz számítása - teljes belső szélesség / (osztók száma + 1)
                var leftDivSpacing = leftInnerWidth / (leftDivisions + 1);
                console.log("Bal szárny egy térköz mérete:", (leftDivSpacing / dimensions.scale).toFixed(1), "mm");

                // Helyezzük el az osztókat a bal szárnyban
                for (var i = 1; i <= leftDivisions; i++) {
                    // Pozíció aránya a teljes szélességhez (0 és 1 között)
                    var position = i / (leftDivisions + 1);
                    // Az i-edik osztó középpontjának pozíciója a bal szárnyban
                    var x = offsetX + dimensions.friezeWidth + (position * leftInnerWidth);
                    // Az osztó bal szélének pozíciója (középpont - szélesség/2)
                    var divisionX = x - (dimensions.verticalDivisionWidth / 2);

                    console.log("Bal szárny " + i + ". osztó arány:", position.toFixed(2));
                    console.log("Bal szárny " + i + ". osztó középpont:", (x / dimensions.scale).toFixed(1), "mm");
                    console.log("Bal szárny " + i + ". osztó bal széle:", (divisionX / dimensions.scale).toFixed(1), "mm");

                    // Eltároljuk az osztó adatait a panel létrehozáshoz és későbbi rajzoláshoz
                    verticalDivisions.push({
                        x: divisionX,
                        width: dimensions.verticalDivisionWidth,
                        isLeftWingDivision: true
                    });
                }
            }

            // Jobb oldali osztók
            if (rightDivisions > 0) {
                // A jobb szárny kezdőpontja a jobb szárny bal frízének jobb széle
                var rightStartX = rightWingLeftFriezeX + dimensions.friezeWidth;
                // A jobb szárny belső szélessége a középső fríztől a jobb frízig
                var rightInnerWidth = rightSashInnerWidth;

                console.log("%cJOBB SZÁRNY OSZTÓ SZÁMÍTÁS", "color: red; font-weight: bold");
                console.log("Jobb szárny kezdőpontja:", (rightStartX / dimensions.scale).toFixed(1), "mm");
                console.log("Jobb szárny belső szélessége:", (rightInnerWidth / dimensions.scale).toFixed(1), "mm");
                console.log("Osztók száma a jobb szárnyban:", rightDivisions);
                console.log("Függőleges osztó szélessége:", (dimensions.verticalDivisionWidth / dimensions.scale).toFixed(1), "mm");

                // Egyszernyi térköz számítása - teljes belső szélesség / (osztók száma + 1)
                var rightDivSpacing = rightInnerWidth / (rightDivisions + 1);
                console.log("Jobb szárny egy térköz mérete:", (rightDivSpacing / dimensions.scale).toFixed(1), "mm");

                // Helyezzük el az osztókat a jobb szárnyban
                for (var i = 1; i <= rightDivisions; i++) {
                    // Pozíció aránya a teljes szélességhez (0 és 1 között)
                    var position = i / (rightDivisions + 1);
                    // Az i-edik osztó középpontjának pozíciója a jobb szárnyban
                    var x = rightStartX + (position * rightInnerWidth);
                    // Az osztó bal szélének pozíciója (középpont - szélesség/2)
                    var divisionX = x - (dimensions.verticalDivisionWidth / 2);

                    console.log("Jobb szárny " + i + ". osztó arány:", position.toFixed(2));
                    console.log("Jobb szárny " + i + ". osztó középpont:", (x / dimensions.scale).toFixed(1), "mm");
                    console.log("Jobb szárny " + i + ". osztó bal széle:", (divisionX / dimensions.scale).toFixed(1), "mm");

                    // Eltároljuk az osztó adatait a panel létrehozáshoz és későbbi rajzoláshoz
                    verticalDivisions.push({
                        x: divisionX,
                        width: dimensions.verticalDivisionWidth,
                        isRightWingDivision: true
                    });
                }
            }
        } else {
            // Egyszárnyú ablak - eredeti logika, részletes logokkal
            var availableWidth = dimensions.width - (dimensions.friezeWidth * 2);

            console.log("%cEGYSZÁRNYÚ ABLAK OSZTÓ SZÁMÍTÁS", "color: red; font-weight: bold");
            console.log("Ablak teljes belső szélessége:", (availableWidth / dimensions.scale).toFixed(1), "mm");
            console.log("Függőleges osztók száma:", params.vertical_divisions);
            console.log("Függőleges osztó szélessége:", (dimensions.verticalDivisionWidth / dimensions.scale).toFixed(1), "mm");

            var spacing = availableWidth / (parseInt(params.vertical_divisions) + 1);
            console.log("Egy térköz mérete:", (spacing / dimensions.scale).toFixed(1), "mm");

            for (var i = 1; i <= params.vertical_divisions; i++) {
                // Az i-edik osztó középpontjának pozíciója
                var divCenter = offsetX + dimensions.friezeWidth + (spacing * i);
                // Az osztó bal szélének pozíciója (középpont - szélesség/2)
                var x = divCenter - (dimensions.verticalDivisionWidth / 2);

                console.log(i + ". osztó középpont:", (divCenter / dimensions.scale).toFixed(1), "mm");
                console.log(i + ". osztó bal széle:", (x / dimensions.scale).toFixed(1), "mm");

                // Eltároljuk az osztó adatait a panel létrehozáshoz és későbbi rajzoláshoz
                verticalDivisions.push({
                    x: x,
                    width: dimensions.verticalDivisionWidth,
                    isSingleDivision: true
                });
            }
        }
    }

    // Panelek létrehozása - Ruby oldali panel méretekkel
    console.log("%c[ABLAK RAJZ] Panelek létrehozása Ruby oldali méretekkel...", "color: orange");

    // Panel méretek lekérése a Ruby oldaltól
    getWindowPanelDimensions(params).then(panelDimensions => {
        console.log("Ruby oldali panel méretek:", panelDimensions);
        createWindowPanels(params, dimensions, horizontalDivisions, verticalDivisions, panelDimensions);
    }).catch(error => {
        console.error("Hiba a Ruby oldali panel méretek lekérése közben:", error);
        // Fallback: JavaScript oldali számítás, ha a Ruby oldali nem működik
        createWindowPanels(params, dimensions, horizontalDivisions, verticalDivisions);
    });

    // Frízek rajzolása - a villanyóra canvas megjelenítési sorrendjét követve
    if (isMultiSash) {
        console.log("%c[ABLAK RAJZ] Frízek rajzolása - kétszárnyú ablak", "color: orange");
        console.log("Fő szárny szélessége:", mainWingWidth);

        // Középső frízek - kétszárnyú ablakonál
        if (isAsymmetric) {
            console.log("Aszimmetrikus kétszárnyú frízek rajzolása");
            // Aszimmetrikus kétszárnyú - bal szárny jobb oldali fríz
            windowCanvas.add(new fabric.Rect({
                left: offsetX + mainWingWidth - dimensions.friezeWidth,
                top: offsetY,
                width: dimensions.friezeWidth,
                height: dimensions.height,
                fill: '#a88e6c',  // Fa színű
                stroke: '#805533',
                strokeWidth: 1,
                selectable: false,
                zIndex: windowZIndexes.frieze
            }));

            // Aszimmetrikus kétszárnyú - jobb szárny bal oldali fríz
            windowCanvas.add(new fabric.Rect({
                left: offsetX + mainWingWidth,
                top: offsetY,
                width: dimensions.friezeWidth,
                height: dimensions.height,
                fill: '#a88e6c',  // Fa színű
                stroke: '#805533',
                strokeWidth: 1,
                selectable: false,
                zIndex: windowZIndexes.frieze
            }));
        } else {
            console.log("Szimmetrikus kétszárnyú frízek rajzolása, középpont:", dimensions.width/2);
            // Szimmetrikus kétszárnyú - bal szárny jobb oldali fríz
            windowCanvas.add(new fabric.Rect({
                left: offsetX + dimensions.width/2 - dimensions.friezeWidth,
                top: offsetY,
                width: dimensions.friezeWidth,
                height: dimensions.height,
                fill: '#a88e6c',  // Fa színű
                stroke: '#805533',
                strokeWidth: 1,
                selectable: false,
                zIndex: windowZIndexes.frieze
            }));

            // Szimmetrikus kétszárnyú - jobb szárny bal oldali fríz
            windowCanvas.add(new fabric.Rect({
                left: offsetX + dimensions.width/2,
                top: offsetY,
                width: dimensions.friezeWidth,
                height: dimensions.height,
                fill: '#a88e6c',  // Fa színű
                stroke: '#805533',
                strokeWidth: 1,
                selectable: false,
                zIndex: windowZIndexes.frieze
            }));
        }
    } else {
        // Egyszárnyú ablak - bal és jobb oldali frízek
        console.log("%c[ABLAK RAJZ] Frízek rajzolása - egyszárnyú ablak", "color: orange");

        // Bal oldali fríz
        windowCanvas.add(new fabric.Rect({
            left: offsetX,
            top: offsetY,
            width: dimensions.friezeWidth,
            height: dimensions.height,
            fill: '#a88e6c',  // Fa színű
            stroke: '#805533',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.frieze
        }));

        // Jobb oldali fríz
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.width - dimensions.friezeWidth,
            top: offsetY,
            width: dimensions.friezeWidth,
            height: dimensions.height,
            fill: '#a88e6c',  // Fa színű
            stroke: '#805533',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.frieze
        }));
    }

    // Felső és alsó csapos elemek rajzolása
    console.log("%c[ABLAK RAJZ] Csapos elemek rajzolása", "color: orange");

    if (isMultiSash) {
        // Kétszárnyú ablak csapos elemei
        // Felső csapos elemek
        var leftWingWidth = isAsymmetric ? mainWingWidth : dimensions.width/2;

        // Bal szárny felső csapos elem
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth - dimensions.tenonLength,
            top: offsetY,
            width: leftWingWidth - dimensions.friezeWidth - dimensions.friezeWidth + (2 * dimensions.tenonLength),
            height: dimensions.upperTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));

        // Jobb szárny felső csapos elem
        var rightStart = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) + dimensions.friezeWidth;
        windowCanvas.add(new fabric.Rect({
            left: rightStart - dimensions.tenonLength,
            top: offsetY,
            width: dimensions.width - (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth - dimensions.friezeWidth + (2 * dimensions.tenonLength),
            height: dimensions.upperTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));

        // Alsó csapos elemek
        // Bal szárny alsó csapos elem
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth - dimensions.tenonLength,
            top: offsetY + dimensions.height - dimensions.lowerTenonedWidth,
            width: leftWingWidth - dimensions.friezeWidth - dimensions.friezeWidth + (2 * dimensions.tenonLength),
            height: dimensions.lowerTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));

        // Jobb szárny alsó csapos elem
        windowCanvas.add(new fabric.Rect({
            left: rightStart - dimensions.tenonLength,
            top: offsetY + dimensions.height - dimensions.lowerTenonedWidth,
            width: dimensions.width - (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth - dimensions.friezeWidth + (2 * dimensions.tenonLength),
            height: dimensions.lowerTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));
    } else {
        // Egyszárnyú ablak csapos elemei
        // Felső csapos elem
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth - dimensions.tenonLength,
            top: offsetY,
            width: dimensions.width - (dimensions.friezeWidth * 2) + (dimensions.tenonLength * 2),
            height: dimensions.upperTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));

        // Alsó csapos elem
        windowCanvas.add(new fabric.Rect({
            left: offsetX + dimensions.friezeWidth - dimensions.tenonLength,
            top: offsetY + dimensions.height - dimensions.lowerTenonedWidth,
            width: dimensions.width - (dimensions.friezeWidth * 2) + (dimensions.tenonLength * 2),
            height: dimensions.lowerTenonedWidth,
            fill: '#b0b0b0',  // Világos szürke
            stroke: '#ffffff',
            strokeWidth: 1,
            selectable: false,
            zIndex: windowZIndexes.csapos // Csapos elemek z-indexe
        }));
    }

    // Függőleges osztók szakaszosan történő rajzolása legutoljára, hogy minden más elem felett legyenek
    console.log("%c[ABLAK RAJZ] Függőleges osztók szakaszos rajzolása...", "color: orange");
    if (verticalDivisions.length > 0) {
        console.log("%c[DEBUG] Függőleges osztók összesítése:", "color: red; font-weight: bold");
        console.log("Függőleges osztók száma:", verticalDivisions.length);
        console.log("Függőleges osztó szélesség:", dimensions.verticalDivisionWidth, "px");

        // Részletes osztó adatok kiírása
        for (var i = 0; i < verticalDivisions.length; i++) {
            var division = verticalDivisions[i];
            console.log("%c[DEBUG] Osztó #" + i + " adatai:", "color: purple", division);
            console.log("  - X pozíció:", division.x);
            console.log("  - Szélesség:", division.width);
            console.log("  - Bal szárnyban van:", division.isLeftWingDivision ? "IGEN" : "NEM");
            console.log("  - Jobb szárnyban van:", division.isRightWingDivision ? "IGEN" : "NEM");
        }
        for (var i = 0; i < verticalDivisions.length; i++) {
            var division = verticalDivisions[i];
            console.log("Függőleges osztó rajzolása:", division);

            // Ellenőrizzük, hogy a függőleges osztó nem esik-e a középső fríz pozíciójába
            if (isMultiSash) {
                var middleX = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2);
                if (Math.abs(division.x + (division.width/2) - middleX) <= 5) {
                    console.log("Középső fríz helye, kihagyjuk:", division.x, middleX);
                    continue;  // Ha középső fríz helye, akkor kihagyjuk
                }
            }

            // Ellenőrizzük, hogy ez a bal szárny jobb oldali frízénél lévő osztó-e
            var isLeftWingLastDivision = false;
            var isRightWingFirstDivision = false;
            if (isMultiSash && division.isLeftWingDivision) {
                var leftWingRightEdge = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth;
                // Ellenőrizzük, hogy ez az osztó a bal szárny jobb oldali frízéhez közel van-e
                if (Math.abs((division.x + division.width) - leftWingRightEdge) < 5) {
                    isLeftWingLastDivision = true;
                    console.log("Bal szárny utolsó osztója:", division.x, leftWingRightEdge);
                }
            }

            // Ellenőrizzük, hogy ez a jobb szárny első osztója-e
            if (isMultiSash && division.isRightWingDivision) {
                var rightWingLeftEdge = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) + dimensions.friezeWidth;
                // Ellenőrizzük, hogy ez az osztó a jobb szárny bal oldali frízéhez közel van-e
                if (Math.abs(division.x - rightWingLeftEdge) < 5) {
                    isRightWingFirstDivision = true;
                    console.log("Jobb szárny első osztója:", division.x, rightWingLeftEdge);
                }
            }

            // Legfelső szakasz: felső csapos elemétől az első vízszintes osztóig
            // Pontosan a villanyóra szekrény kód számítását követjük, de figyelembe véve az offsetY-t
            var startY = offsetY + dimensions.upperTenonedWidth - dimensions.tenonLength;
            var endY = horizontalDivisions.length > 0 ?
                  // A felső vízszintes osztó alsó széléig + csap hossza
                  offsetY + horizontalDivisions[0].y_relative + dimensions.tenonLength :
                  offsetY + dimensions.height - dimensions.lowerTenonedWidth + dimensions.tenonLength;

            var divisionLeft = division.x;
            // Függőleges osztó szélesség - mindig a dimensions.verticalDivisionWidth értéket használjuk
            // az egyes osztókhoz tárolt értékek helyett a konzisztencia érdekében
            var divisionWidth = dimensions.verticalDivisionWidth;

            // Ha ez a bal szárny utolsó osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
            if (isLeftWingLastDivision) {
                // A bal szárny jobb oldali frízének belső széle
                var leftWingRightEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth;
                // Az osztót a fríz belső szélétől kell elhelyezni, hogy a csap túlnúlúljon
                divisionLeft = leftWingRightEdgeInner - dimensions.tenonLength;
            }

            // Ha ez a jobb szárny első osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
            if (isRightWingFirstDivision) {
                // A jobb szárny bal oldali frízének belső széle
                var rightWingLeftEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) + dimensions.friezeWidth;
                // Az osztót a fríz belső szélétől kell elhelyezni, hogy a csap túlnúlúljon
                divisionLeft = rightWingLeftEdgeInner - dimensions.verticalDivisionWidth + dimensions.tenonLength;
            }

            console.log("Legfelső szakasz rajzolása:", divisionLeft, startY, divisionWidth, endY - startY);

            // Legfelső szakasz rajzolása
            windowCanvas.add(new fabric.Rect({
                left: divisionLeft,
                top: startY,
                width: divisionWidth,
                height: endY - startY,
                fill: '#ff8800',  // Feltűnő narancs szín a jobb láthatóságért
                stroke: '#ffffff',
                strokeWidth: 1,
                selectable: false,
                zIndex: windowZIndexes.division + 10 // Magasabb z-index, hogy biztosan látszódjon
            }));
                        // Középső szakaszok: vízszintes osztók között
            if (horizontalDivisions.length > 1) {
                // Rendezzük a vízszintes osztókat fent-le sorrendben
                var sortedHorizontalDivs = horizontalDivisions.slice().sort(function(a, b) {
                    return a.y - b.y;
                });

                for (var j = 0; j < sortedHorizontalDivs.length - 1; j++) {
                    var currentDiv = sortedHorizontalDivs[j];
                    var nextDiv = sortedHorizontalDivs[j+1];

                    // Ha ez a bal szárny utolsó osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
                    var divisionLeftMiddle = division.x;
                    if (isLeftWingLastDivision) {
                        var leftWingRightEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth;
                        divisionLeftMiddle = leftWingRightEdgeInner - dimensions.tenonLength;
                    }

                    // Szakasz pozíciók kiszámítása - pontosan a villanyóra szekrény kód szerint
                    // Az offset nélküli pozíciókkal dolgozunk, majd hozzáadjuk az offsetY-t
                    var sectionStartY = offsetY + currentDiv.y_relative + currentDiv.height - dimensions.tenonLength;
                    var sectionEndY = offsetY + nextDiv.y_relative + dimensions.tenonLength;

                    // Középső szakasz eredeti pozíciójának mentése
                    var middleLeft = divisionLeftMiddle;

                    // Ha ez a jobb szárny első osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
                    if (isRightWingFirstDivision) {
                        var rightWingLeftEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) + dimensions.friezeWidth;
                        middleLeft = rightWingLeftEdgeInner - dimensions.verticalDivisionWidth + dimensions.tenonLength;
                        console.log("%c[DEBUG] Jobb szárny első osztójának középső szakasza:", "color: green",
                                  "eredeti x:", division.x,
                                  "módosított x:", middleLeft);
                    }

                    var middleTop = sectionStartY;
                    // Mindig a dimensions.verticalDivisionWidth értéket használjuk
                    var middleWidth = dimensions.verticalDivisionWidth;
                    var middleHeight = sectionEndY - sectionStartY;

                    console.log("Középső szakasz rajzolása:", middleLeft, middleTop, middleWidth, middleHeight);
                    console.log("%c[DEBUG] Osztó típusa:", "color: blue",
                              "Bal szárny utolsó:", isLeftWingLastDivision,
                              "Jobb szárny első:", isRightWingFirstDivision);

                    // Középső szakasz rajzolása
                    windowCanvas.add(new fabric.Rect({
                        left: middleLeft,
                        top: middleTop,
                        width: middleWidth,
                        height: middleHeight,
                        fill: '#ff8800',  // Feltűnő narancs szín a jobb láthatóságért
                        stroke: '#ffffff',
                        strokeWidth: 1,
                        selectable: false,
                        zIndex: windowZIndexes.division + 10 // Magasabb z-index, hogy biztosan látszódjon
                    }));
                }
            }

            // Legalsó szakasz: az utolsó vízszintes osztótól az alsó csapos elemig
            if (horizontalDivisions.length > 0) {
                var lastDiv = horizontalDivisions.slice().sort(function(a, b) {
                    return a.y - b.y;
                })[horizontalDivisions.length - 1];

                // Legalsó szakasz koordinátái - pontosan a villanyóra szekrény kód szerint
                // Relatív pozícióval számolunk, majd hozzáadjuk az offsetY-t
                var lastStartY = offsetY + lastDiv.y_relative + lastDiv.height - dimensions.tenonLength;
                var lastEndY = offsetY + dimensions.height - dimensions.lowerTenonedWidth + dimensions.tenonLength;

                // Ha ez a bal szárny utolsó osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
                var divisionLeftLast = division.x;
                if (isLeftWingLastDivision) {
                    var leftWingRightEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) - dimensions.friezeWidth;
                    divisionLeftLast = leftWingRightEdgeInner - dimensions.tenonLength;
                    console.log("%c[DEBUG] Bal szárny utolsó osztójának alsó szakasza", "color: green",
                               "eredeti x:", division.x,
                               "módosított x:", divisionLeftLast);
                }

                // Ha ez a jobb szárny első osztója, akkor a fríz belső szélétől kell túlnúlónak lennie
                if (isRightWingFirstDivision) {
                    var rightWingLeftEdgeInner = offsetX + (isAsymmetric ? mainWingWidth : dimensions.width/2) + dimensions.friezeWidth;
                    divisionLeftLast = rightWingLeftEdgeInner - dimensions.verticalDivisionWidth + dimensions.tenonLength;
                    console.log("%c[DEBUG] Jobb szárny első osztójának alsó szakasza", "color: green",
                               "eredeti x:", division.x,
                               "módosított x:", divisionLeftLast);
                }

                console.log("Legalsó szakasz rajzolása:", divisionLeftLast, lastStartY, divisionWidth, lastEndY - lastStartY);

                // Legalsó szakasz rajzolása
                // Mindig a dimensions.verticalDivisionWidth értéket használjuk
                var lastWidth = dimensions.verticalDivisionWidth;

                windowCanvas.add(new fabric.Rect({
                    left: divisionLeftLast,
                    top: lastStartY,
                    width: lastWidth,
                    height: lastEndY - lastStartY,
                    fill: '#ff8800',  // Feltűnő narancs szín a jobb láthatóságért
                    stroke: '#ffffff',
                    strokeWidth: 1,
                    selectable: false,
                    zIndex: windowZIndexes.division + 10 // Magasabb z-index, hogy biztosan látszódjon
                }));
            }
        }
    }

    // Canvas frissítése
    console.log("%c[ABLAK RAJZ] Canvas renderelése...", "color: orange");
    windowCanvas.renderAll();

    console.log("%c[ABLAK RAJZ] Ablak rajzolása sikeresen befejezve.", "color: orange; font-weight: bold");
    console.log("%c[ABLAK RAJZ] Végső canvas méretek:", "color: orange", {
        width: windowCanvas.width,
        height: windowCanvas.height,
        objectCount: windowCanvas.getObjects().length
    });
}

/**
 * Összegyűjti az ablak panelek adatait a SketchUp API számára
 * @returns {Object} Az ablak panelek adatai
 */
function collectWindowPanelData() {
    var panelData = [];

    // Végigmegyünk az összes panel adaton
    for (var panelId in windowPanelData) {
        if (windowPanelData.hasOwnProperty(panelId)) {
            var panel = windowPanelData[panelId];

            // Csak a szükséges adatokat adjuk hozzá
            panelData.push({
                id: panelId,
                row: panel.row,
                col: panel.col,
                type: panel.type || 'glass', // Alapértelmezett típus: üveg
                width: panel.width,
                height: panel.height,
                left: panel.left,
                top: panel.top
            });
        }
    }

    return panelData;
}

/**
 * Generálja az ablak komponenseket a SketchUp-ban
 * @param {Object} params - Az ablak paraméterei
 */
function generateWindow(params) {
    console.log("Ablak komponensek generálása a SketchUp-ban...");

    // Ellenőrizzük, hogy van-e sketchup objektum
    if (!window.sketchup) {
        console.error("Nem található a SketchUp API objektum!");
        alert("Nem található a SketchUp API objektum! Ellenőrizze, hogy a plugin fut-e a SketchUp-ban.");
        return;
    }

    // Panel adatok összegyűjtése
    var panelData = collectWindowPanelData();

    // Paraméterek összegyűjtése
    var windowParams = {
        // Alap paraméterek
        element_type: "Ablak", // Explicit megadjuk, hogy ez egy ablak
        window_type: params.window_type || 'Egyszárnyú',
        width: parseInt(params.width) || 900,
        height: parseInt(params.height) || 1500,
        count: parseInt(params.count) || 1,

        // Keret paraméterek
        frame_wood_width: parseInt(params.frame_wood_width) || 60,
        frame_wood_thickness: parseInt(params.frame_wood_depth) || 70,
        frame_width: parseInt(params.width) || 900,  // Explicit megadjuk a tok külméretét
        frame_height: parseInt(params.height) || 1500,

        // Nyíló levonás paraméterek
        sash_width_deduction: parseInt(params.sash_width_deduction) || 50,
        sash_height_deduction: parseInt(params.sash_height_deduction) || 50,
        sash_wood_width: parseInt(params.sash_wood_width) || 60,
        sash_wood_thickness: parseInt(params.sash_wood_thickness) || 40,

        // Osztó paraméterek
        division_wood_width: parseInt(params.division_wood_width) || 60,
        division_wood_depth: parseInt(params.division_wood_depth) || 70,
        horizontal_divisions: parseInt(params.horizontal_divisions) || 0,
        vertical_divisions: parseInt(params.vertical_divisions) || 0,

        // Panel paraméterek
        window_panels: panelData, // Explicit megadjuk, hogy ezek ablak panelek

        // Anyag paraméterek
        glass_thickness: parseInt(params.glass_thickness) || 4,
        wood_thickness: parseInt(params.wood_thickness) || 20,
        glass_overlap: parseInt(params.glass_overlap) || 5,
        wood_overlap: parseInt(params.wood_overlap) || 5
    };

    // Paraméterek átadása a SketchUp API-nak JSON formátumban
    var jsonParams = JSON.stringify(windowParams);
    console.log("Paraméterek átadása a SketchUp-nak:", jsonParams);

    try {
        // Ablak komponensek generálása a SketchUp-ban a dialog.html-ben működő API-val
        sketchup.generateComponents(jsonParams);
        console.log("Ablak komponensek sikeresen generálva a SketchUp-ban");

        // Visszajelzés a felhasználónak
        alert("Ablak komponensek sikeresen generálva!");
    } catch (error) {
        console.error("Hiba történt az ablak komponensek generálása közben:", error);
        alert("Hiba történt az ablak komponensek generálása közben: " + error.message);
    }
}

/**
 * Frissíti az ablak előnézetet a megadott paraméterek alapján
 */
function updateWindowPreview() {
    console.log("%c[ABLAK UPDATE] Ablak előnézet frissítése...", "color: blue; font-weight: bold");

    // Ellenőrizzük, hogy a getWindowParams függvény elérhető-e
    if (typeof getWindowParams === 'function') {
        console.log("%c[ABLAK UPDATE] getWindowParams függvény elérhető, használjuk azt", "color: blue");
        // Ha elérhető, használjuk azt a paraméterek lekéréséhez
        var params = getWindowParams();
        if (params) {
            console.log("%c[ABLAK UPDATE] Paraméterek sikeresen lekérve:", "color: blue", params);
            console.log("%c[ABLAK UPDATE] Szélesség:", "color: blue", params.width);
            console.log("%c[ABLAK UPDATE] Magasság:", "color: blue", params.height);

            // Ablak rajzolása a canvasre
            console.log("%c[ABLAK RAJZ] Canvas frissítése a paraméterekkel...", "color: orange");
            drawWindow(params);

            // Paraméterek mentése a globális változóba
            window.currentWindowParams = params;
            console.log("%c[ABLAK UPDATE] Paraméterek elmentve a globális változóba", "color: blue");
            console.log("%c[ABLAK UPDATE] Ablak előnézet frissítése kész (getWindowParams használatával)", "color: blue; font-weight: bold");
            return;
        } else {
            console.warn("%c[ABLAK HIBA] getWindowParams nem adott vissza érvényes paramétereket", "color: red");
        }
    } else {
        console.warn("%c[ABLAK HIBA] getWindowParams függvény nem elérhető", "color: red");
    }

    // Ha a getWindowParams nem elérhető vagy nem adott vissza érvényes paramétert,
    // akkor manuálisan gyűjtjük össze a paramétereket
    console.log("%c[ABLAK UPDATE] Manuális paraméter gyűjtés...", "color: purple; font-weight: bold");
    var params = {};

    // Alap paraméterek
    var typeSelect = document.getElementById('window_type');
    if (typeSelect) {
        params.window_type = typeSelect.value || 'Egyszárnyú';
        console.log("%c[ABLAK PARAM] Ablak típus:", "color: purple", params.window_type);
    } else {
        console.warn("%c[ABLAK HIBA] Nem található a window_type input mező", "color: red");
    }

    var widthInput = document.getElementById('window_width');
    if (widthInput) {
        params.width = parseInt(widthInput.value) || 900;
        console.log("%c[ABLAK PARAM] Szélesség:", "color: purple", params.width);
    } else {
        console.warn("%c[ABLAK HIBA] Nem található a window_width input mező", "color: red");
    }

    var heightInput = document.getElementById('window_height');
    if (heightInput) {
        params.height = parseInt(heightInput.value) || 1500;
        console.log("%c[ABLAK PARAM] Magasság:", "color: purple", params.height);
    } else {
        console.warn("%c[ABLAK HIBA] Nem található a window_height input mező", "color: red");
    }

    // Keret paraméterek
    var frameWoodWidthInput = document.getElementById('window_frame_wood_width');
    if (frameWoodWidthInput) {
        params.frame_wood_width = parseInt(frameWoodWidthInput.value) || 60;
    }

    var frameWoodDepthInput = document.getElementById('window_frame_wood_depth');
    if (frameWoodDepthInput) {
        params.frame_wood_depth = parseInt(frameWoodDepthInput.value) || 70;
    }

    // Osztó paraméterek
    var divisionWoodWidthInput = document.getElementById('window_division_wood_width');
    if (divisionWoodWidthInput) {
        params.division_wood_width = parseInt(divisionWoodWidthInput.value) || 60;
    }

    var divisionWoodDepthInput = document.getElementById('window_division_wood_depth');
    if (divisionWoodDepthInput) {
        params.division_wood_depth = parseInt(divisionWoodDepthInput.value) || 70;
    }

    // Függőleges osztó paraméterek
    var verticalDivisionWidthInput = document.getElementById('window_vertical_division_width');
    if (verticalDivisionWidthInput) {
        params.vertical_division_width = parseInt(verticalDivisionWidthInput.value) || 40;
    }

    var verticalDivisionDepthInput = document.getElementById('window_vertical_division_depth');
    if (verticalDivisionDepthInput) {
        params.vertical_division_depth = parseInt(verticalDivisionDepthInput.value) || 70;
    }

    var horizontalDivisionsInput = document.getElementById('window_horizontal_divisions');
    if (horizontalDivisionsInput) {
        params.horizontal_divisions = parseInt(horizontalDivisionsInput.value) || 0;
    }

    var verticalDivisionsInput = document.getElementById('window_vertical_divisions');
    if (verticalDivisionsInput) {
        params.vertical_divisions = parseInt(verticalDivisionsInput.value) || 0;
    }

    // Panel paraméterek - figyelembe vesszük a windowGlass és windowWood prefixű mezőket is
    var glassThicknessInput = document.getElementById('windowGlassThickness') || document.getElementById('window_glass_thickness');
    if (glassThicknessInput) {
        params.glass_thickness = parseInt(glassThicknessInput.value) || 4;
        window.glassThickness = params.glass_thickness;
    }

    var woodThicknessInput = document.getElementById('windowWoodThickness') || document.getElementById('window_wood_thickness');
    if (woodThicknessInput) {
        params.wood_thickness = parseInt(woodThicknessInput.value) || 20;
        window.woodThickness = params.wood_thickness;
    }

    var glassOverlapInput = document.getElementById('windowGlassOverlap') || document.getElementById('window_glass_overlap');
    if (glassOverlapInput) {
        params.glass_overlap = parseInt(glassOverlapInput.value) || 5;
        window.glassOverlap = params.glass_overlap;
    }

    var woodOverlapInput = document.getElementById('windowWoodOverlap') || document.getElementById('window_wood_overlap');
    if (woodOverlapInput) {
        params.wood_overlap = parseInt(woodOverlapInput.value) || 5;
        window.woodOverlap = params.wood_overlap;
    }

    // Darabszám
    var countInput = document.getElementById('window_count');
    if (countInput) {
        params.count = parseInt(countInput.value) || 1;
    }

    // Összes összegyűjtött paraméter kiírása
    console.log("%c[ABLAK PARAM] Összes összegyűjtött paraméter:", "color: purple; font-weight: bold", params);

    // Ablak rajzolása a canvasre
    console.log("%c[ABLAK RAJZ] Canvas frissítése a manuálisan gyűjtött paraméterekkel...", "color: orange");
    drawWindow(params);

    // Paraméterek mentése a globális változóba
    window.currentWindowParams = params;
    console.log("%c[ABLAK PARAM] Paraméterek elmentve a globális változóba", "color: purple");

    console.log("%c[ABLAK UPDATE] Ablak előnézet frissítése kész (manuális paraméter gyűjtéssel)", "color: blue; font-weight: bold");
}

/**
 * Menti az ablak beállításokat
 */
function saveWindowSettings() {
    console.log("Ablak beállítások mentése...");

    // Előnézet frissítése
    updateWindowPreview();

    // Ha van SketchUp API, akkor mentjük a beállításokat
    if (window.sketchup && typeof window.sketchup.saveWindowSettings === 'function') {
        try {
            // A beállítások összegyűjtése
            var settings = {
                params: window.currentWindowParams,
                panels: collectWindowPanelData()
            };

            // Beállítások átadása a SketchUp API-nak
            window.sketchup.saveWindowSettings(JSON.stringify(settings));
            console.log("Ablak beállítások sikeresen mentve");
        } catch (error) {
            console.error("Hiba történt az ablak beállítások mentése közben:", error);
        }
    }
}

// Globális funkciók exportálása
window.initWindowCanvas = initWindowCanvas;
window.drawWindow = drawWindow;
window.updateWindowPreview = updateWindowPreview;
window.updateWindowPanelVisuals = updateWindowPanelVisuals;

