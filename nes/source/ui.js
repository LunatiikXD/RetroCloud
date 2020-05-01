/*
JSNES, based on Jamie Sanders' vNES
Copyright (C) 2010 Ben Firshman

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

JSNES.DummyUI = function(nes) {
    this.nes = nes;
    this.enable = function() {};
    this.updateStatus = function() {};
    this.writeFrame = function() {};
};


var JSNESUI = function(roms) {
    var parent = document.getElementById('emulator');
    var UI = function(nes) {
        var self = this;
        self.nes = nes;

        self.zoomed = false;
        if(localStorage) self.zoomed=JSNES.Utils.strToBool(localStorage.getItem('zoom'));
        if(localStorage) self.nes.opts.emulateSound=JSNES.Utils.strToBool(localStorage.getItem('sound'));

        /*
         * Create UI
         */
        self.root = parent;
        self.screen = document.getElementById('nes-screen');

        if (!self.screen.getContext) {
            parent.html("Your browser doesn't support the <code>&lt;canvas&gt;</code> tag. Try Google Chrome, Safari, Opera or Firefox!");
            return;
        }

        self.romContainer = document.getElementById('nes-roms');
        self.romSelect = document.getElementById('rom-select');

        self.romUpload = document.getElementById('rom-file');

        self.controls = document.getElementById('nes-controls');
        self.buttons = {
            pause:   document.getElementById('btn-pause'),
            restart: document.getElementById('btn-restart'),
            zoom:    document.getElementById('btn-zoom')
        };
        self.status = document.getElementById('nes-status');


        if (self.zoomed) {
            self.screen.setAttribute('class','zoomed');
            self.buttons.zoom.childNodes[0].setAttribute('class','icon-zoom-out');
            self.buttons.zoom.childNodes[1].data = 'Zoom out';
        } else {
            self.screen.setAttribute('class','not-zoomed');
            self.buttons.zoom.childNodes[0].setAttribute('class','icon-zoom-in');
            self.buttons.zoom.childNodes[1].data = 'Zoom in';
        }

        /*
         * ROM loading
         */
        self.romSelect.addEventListener('change', function() {
            self.loadROM();
        });


        // These should be changed to use bind when jquery adds dataTransfer to its Event object.
        self.root.addEventListener("dragenter", JSNES.Utils.cancelEvent, false);
        self.root.addEventListener("dragover", JSNES.Utils.cancelEvent, false);
        self.root.addEventListener("drop", function(e) {
            JSNES.Utils.cancelEvent(e);
            if (!e.dataTransfer) {
                self.updateStatus("Your browser doesn't support reading local files (FileAPI).");
                //alert("Your browser doesn't support reading local files (FileAPI).");
                return;
            }
            var files = e.dataTransfer.files;
            startRomFromFileBlob(files[0]);
        }, false);

        self.romUpload.addEventListener('change', function() {
            var files = self.romUpload.files;
            if (!files) {
                self.updateStatus("Your browser doesn't support reading local files (FileAPI).");
                //alert("Your browser doesn't support reading local files (FileAPI).");
                return;
            }
            startRomFromFileBlob(files[0]);
        })

        function startRomFromFileBlob(file) {
            var reader = new FileReader();
            reader.readAsBinaryString(file);
            reader.onload = function(evt) {
                self.nes.loadRom(evt.target.result);
                self.nes.start();
                self.enable();
            }
        }

        /*
         * Buttons
         */
        self.buttons.pause.addEventListener('click', function() {
            if (self.nes.isRunning) {
                self.nes.stop();
                self.updateStatus("Paused");
                self.buttons.pause.childNodes[0].setAttribute('class','icon-play');
                self.buttons.pause.childNodes[1].data = 'Resume';
            } else {
                self.nes.start();
                self.buttons.pause.childNodes[0].setAttribute('class','icon-pause');
                self.buttons.pause.childNodes[1].data = 'Pause';
            }
        });

        self.buttons.restart.addEventListener('click',function() {
            self.nes.reloadRom();
            self.nes.start();
        });

       
        self.buttons.zoom.addEventListener('click', function() {
            if (self.zoomed) {
                self.zoomed = false;
                if(localStorage) localStorage.setItem('zoom', false);
                self.screen.setAttribute('class','not-zoomed');
                self.buttons.zoom.childNodes[0].setAttribute('class','icon-zoom-in');
                self.buttons.zoom.childNodes[1].data = 'Zoom in';
            } else {
                self.zoomed = true;
                if(localStorage) localStorage.setItem('zoom', true);
                self.screen.setAttribute('class','zoomed');
                self.buttons.zoom.childNodes[0].setAttribute('class','icon-zoom-out');
                self.buttons.zoom.childNodes[1].data = 'Zoom out';
            }
        });

        /*
         * Lightgun experiments with mouse
         * (Requires jquery.dimensions.js)
         */
        //if ($.offset) {
        self.screen.addEventListener('mousedown', function(e) {
            if (self.nes.mmap) {
                self.nes.mmap.mousePressed = true;
                // FIXME: does not take into account zoom
//                    self.nes.mmap.mouseX = e.pageX - self.screen.offset().left;
//                    self.nes.mmap.mouseY = e.pageY - self.screen.offset().top;
                self.nes.mmap.mouseX = e.pageX - self.screen.offsetLeft;
                self.nes.mmap.mouseY = e.pageY - self.screen.offsetTop;
                console.log(self.nes.mmap.mouseX);
                console.log(self.nes.mmap.mouseY);
            }
        });
        self.screen.addEventListener('mouseup', function() {
            setTimeout(function() {
                if (self.nes.mmap) {
                    self.nes.mmap.mousePressed = false;
                    self.nes.mmap.mouseX = 0;
                    self.nes.mmap.mouseY = 0;
                }
            }, 500);
        });
        //}

        if (typeof roms != 'undefined') {
            self.setRoms(roms);
        }

        /*
         * Canvas
         */
        self.canvasContext = self.screen.getContext('2d');

        if (!self.canvasContext.getImageData) {
            parent.html("Your browser doesn't support writing pixels directly to the <code>&lt;canvas&gt;</code> tag. Try the latest versions of Google Chrome, Safari, Opera or Firefox!");
            return;
        }

        self.canvasImageData = self.canvasContext.getImageData(0, 0, 256, 240);
        self.resetCanvas();

        /*
         * Keyboard
         */
        document.addEventListener('keydown', function(evt) {
            self.nes.keyboard.keyDown(evt);
        });
        document.addEventListener('keyup', function(evt) {
            self.nes.keyboard.keyUp(evt);
        });
        document.addEventListener('keypress', function(evt) {
            self.nes.keyboard.keyPress(evt);
        });

        /*
         * Sound
         */
        if (!WebAudio || !WebAudio.audioContext) {
            self.dynamicaudio = new DynamicAudio({
                swf: nes.opts.swfPath+'dynamicaudio.swf'
            });
        }
    };

    UI.prototype = {
        loadROM: function() {
            var self = this;
            self.updateStatus("Downloading...");

            var xhr = null;
            if (window.XMLHttpRequest) { xhr = new XMLHttpRequest(); }
            else {
                try { xhr = new ActiveXObject("Msxml2.XMLHTTP"); }
                catch (e) {
                    try { xhr = new ActiveXObject("Microsoft.XMLHTTP"); }
                    catch (ex) { }
                }
            }
            if (!xhr) { self.updateStatus('ERROR: Cannot create an XMLHTTP instance'); return false; }
            if (xhr.overrideMimeType) { xhr.overrideMimeType('text/plain; charset=x-user-defined'); }
            xhr.open('GET', self.romSelect.value, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    var data = null;
                    if (JSNES.Utils.isIE() && !JSNES.Utils.isIE10()) {
                        var charCodes = JSNESBinaryToArray(xhr.responseBody).toArray();
                        data = String.fromCharCode.apply(undefined, charCodes);
                    } else {
                        data = xhr.responseText;
                    }
                    self.nes.loadRom(data);
                    self.nes.start();
                    self.enable();
                } else {
                    self.updateStatus('Rom not loaded. Some errors.');
                }
            };
            try {
                xhr.send("");
            } catch (e) {
                if(e.code == 101 && e.name == 'NETWORK_ERR') {
                    this.updateStatus('ERROR! Try to use JSNES from local PC? Cross origin requests are only supported for HTTP. Run JSNES from you server!');
                } else {
                    this.updateStatus(e);
                }
            }
        },

        resetCanvas: function() {
            this.canvasContext.fillStyle = 'black';
            // set alpha to opaque
            this.canvasContext.fillRect(0, 0, 256, 240);

            // Set alpha
            for (var i = 3; i < this.canvasImageData.data.length-3; i += 4) {
                this.canvasImageData.data[i] = 0xFF;
            }
        },

        /*
         * Enable and reset UI elements
         */
        enable: function() {
            this.buttons.pause.removeAttribute("disabled");
            this.buttons.restart.removeAttribute("disabled");
            this.buttons.sound.removeAttribute("disabled");

            if (this.nes.isRunning) {
                this.buttons.pause.childNodes[0].setAttribute('class','icon-pause');
                this.buttons.pause.childNodes[1].data = 'Pause';
            } else {
                this.buttons.pause.childNodes[0].setAttribute('class','icon-play');
                this.buttons.pause.childNodes[1].data = 'Resume';
            }

           
        },

        updateStatus: function(s) {
            this.status.innerText = s;
        },

        setRoms: function(roms) {
            for (var groupName in roms) {
                if (roms.hasOwnProperty(groupName)) {
                    var optgroup = document.createElement('optgroup');
                    optgroup.setAttribute('label', groupName);
                    for (var i = 0; i < roms[groupName].length; i++) {
                        var option = document.createElement('option');
                        option.innerText = roms[groupName][i][0];
                        option.setAttribute('value', roms[groupName][i][1]);
                        optgroup.appendChild(option);
                    }
                    this.romSelect.appendChild(optgroup);
                }
            }
        },

        
        writeFrame: function(buffer, prevBuffer) {
            var imageData = this.canvasImageData.data;
            var pixel, i, j;

            for (i=0; i<256*240; i++) {
                pixel = buffer[i];

                if (pixel != prevBuffer[i]) {
                    j = i*4;
                    imageData[j] = pixel & 0xFF;
                    imageData[j+1] = (pixel >> 8) & 0xFF;
                    imageData[j+2] = (pixel >> 16) & 0xFF;
                    prevBuffer[i] = pixel;
                }
            }

            this.canvasContext.putImageData(this.canvasImageData, 0, 0);
        }
    };
        
            return UI;
        };

