/**
 * c64vdc - A movie to petscii converter by Drn 2017/18
 * Thanks to c64os.com for idea and single image elaboration code
 */

var c64vdc = function (args) {

    if (typeof args != "undefined") {
        if (typeof args.gap == 'undefined' || args.gap <= 0) {
            throw new Error('Arguments gap not defined or <= 0');
            return;
        }
        if (typeof args.video == 'undefined' || args.video == "") {
            throw new Error('Arguments video not defined or null');
            return;
        }
    } else {
        throw new Error('No arguments defined!');
        return;
    }

    this.video = document.createElement("video");
    this.thumbs = document.createElement("div");
    this.frames = []; //qui ci sono tutti i frames del video catturato
    this.gap = args.gap; //0.1; //0.33;

    this.CHARSET = "chars"
    this.CHARACTERS = 256;
    this.WIDTH = 320;
    this.HEIGHT = 200;
    this.CWIDTH = 8;
    this.CHEIGHT = 8;

    this.context = undefined;

    this.chardata = [];
    this.srcdata = [];
    this.petscii = new Uint8Array((this.WIDTH / this.CWIDTH) * (this.HEIGHT / this.CHEIGHT)); //qui tutti i dati c64 come DATA (1000 bytes)

    this.characterContainer;
    this.characterCanvas = [];

    this.video.preload = "auto";
    this.video.src = args.video;
    this.video.currentTime = 0;

    this.startVideoFramesCapture = function () {
        return new Promise(function (resolve, reject) {
            var self = this;
            var counter = 0;

            this.video.addEventListener('loadeddata', function () {
                //self.thumbs.innerHTML = "";
                self.video.currentTime = counter;
            }, false);

            this.video.addEventListener('seeked', function () {
                self.frames.push(self.generateThumbnail());

                counter += self.gap;

                if (counter <= self.video.duration) {
                    self.video.currentTime = counter;
                }
                else {
                    // DONE
                    console.log("done!");
                    resolve(self.frames);
                }

            }, false);
        }.bind(this));
    }

    this.startPetsciiRender = function () {
        return new Promise(function (resolve, reject) {
            console.log(1);
            var self = this;
            var allPetscii = [];
            var output = {
                cavases: [],
                allpetscii: []
            }

            for (var i = 0; i < self.CHARACTERS; i++) {
                var charCanvas = document.createElement("canvas");
                self.characterCanvas.push(charCanvas);
            }

            self.character = document.createElement("img");

            var i = 0;
            self.character.onload = function () {

                var charCanvas = self.characterCanvas[i];
                var charContext = charCanvas.getContext("2d");

                charContext.drawImage(self.character, 0, 0);

                var pxbuf = self.greyscale(charContext, self.CWIDTH, self.CHEIGHT, true); //Skip Dither

                //... and B&W
                for (var px = 0; px < pxbuf.length; px++) {
                    if (pxbuf[px] < 128)
                        pxbuf[px] = 0;
                    else
                        pxbuf[px] = 255;
                }

                self.chardata[i] = pxbuf;
                i++;
                loadCharacter();
                
            };

            var loadCharacter = function () {
                if (i >= self.CHARACTERS) {

                    var myc = document.getElementById('mycontainer');
                    var canvas = document.createElement("canvas"); //document.getElementById('canvas');
                    canvas.setAttribute("width", self.WIDTH);
                    canvas.setAttribute("height", self.HEIGHT);
                    self.context = canvas.getContext("2d");

                    for (var k = 0; k < self.frames.length; k++) {
                        self.source = self.frames[k];
                        self.context.drawImage(self.source, 0, 0, self.WIDTH, self.HEIGHT);
                        self.srcdata = self.greyscale(self.context, self.WIDTH, self.HEIGHT);
                        self.render();
                        output.cavases.push(self.cloneCanvas(canvas));
                        myc.appendChild(self.cloneCanvas(canvas));
                        output.allpetscii.push(self.petscii);
                    }

                    resolve(output);
                }
                self.character.src = self.CHARSET + "/" + i + ".gif";
            };

            loadCharacter();
        }.bind(this));
    };

    this.generateThumbnail = function () {
        var c = document.createElement("canvas");
        var ctx = c.getContext("2d");
        c.width = 320;
        c.height = 200;
        ctx.drawImage(this.video, 0, 0, 320, 200);

        var image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = c.toDataURL("image/png");

        return image;
    }

    this.greyscale = function (ctx, w, h, skip) {
        var imgd = ctx.getImageData(0, 0, w, h);
        var pix = imgd.data;

        var x = 0;
        var y = 0;

        var id = ctx.createImageData(1, 1);
        var d = id.data;

        var ebBuf = [];

        for (var i = 0, il = pix.length; i < il; i += 4) {
            var grayscale = pix[i] * .3 + pix[i + 1] * .59 + pix[i + 2] * .11;

            //Weight the alpha channel. --Thanks to Chris Roy!
            var aDiff = 256 - pix[i + 3];
            var gDiff = 256 - grayscale;

            grayscale = (gDiff * aDiff / 256) + grayscale;

            ebBuf.push(grayscale);
        }

        if (!skip) {
            this.dither(ebBuf, w, h);

            for (var i = 0; i < ebBuf.length; i++) {
                d[0] = ebBuf[i];
                d[1] = ebBuf[i];
                d[2] = ebBuf[i];
                d[3] = 255;
                ctx.putImageData(id, x, y);

                x++;
                if (x >= this.WIDTH) {
                    x = 0
                    y++;
                }
            }
        }

        return ebBuf;
    };

    this.dither = function (sb, w, h) {   // source buffer, width, height
        for (var i = 0; i < h; i++) {
            for (var j = 0; j < w; j++) {
                var ci = i * w + j;               // current buffer index
                var cc = sb[ci];              // current color
                var rc = (cc < 128 ? 0 : 255);      // real (rounded) color
                var err = cc - rc;              // error amount

                sb[ci] = rc;                  // saving real color

                if (j + 1 < w) {
                    sb[ci + 1] += (err * 7) >> 4;  // if right neighbour exists
                }

                if (i + 1 == h) continue;   // if we are in the last line

                if (j > 0) {
                    sb[ci + w - 1] += (err * 3) >> 4;  // bottom left neighbour
                }

                sb[ci + w] += (err * 5) >> 4;  // bottom neighbour

                if (j + 1 < w) {
                    sb[ci + w + 1] += (err * 1) >> 4;  // bottom right neighbour
                }
            }
        }
    };

    this.render = function () {
        var charsWide = this.WIDTH / this.CWIDTH;
        var charsHigh = this.HEIGHT / this.CHEIGHT;

        var charCount = charsWide * charsHigh;

        var c = 0;
        for (var y = 0; y < charsHigh; y++) {
            for (var x = 0; x < charsWide; x++) {
                var charBuf = this.getSourceChar(c);
                var petValue = this.findMatch(charBuf);

                this.petscii[c] = petValue;

                this.context.drawImage(this.characterCanvas[petValue], x * this.CWIDTH, y * this.CHEIGHT);
                c++;
            }
        }
    };

    this.getSourceChar = function (c) {
        var charsWide = (this.WIDTH / this.CWIDTH);

        var bytesPerRastRow = this.CWIDTH * charsWide
        var bytesPerCharRow = this.CHEIGHT * bytesPerRastRow;

        var startByte = 0;
        while (c > charsWide) {
            startByte += bytesPerCharRow;
            c -= charsWide;
        }

        while (c) {
            startByte += this.CWIDTH;
            c--;
        }

        var charBuf = [];
        for (var y = 0; y < this.CHEIGHT; y++) {
            for (var x = 0; x < this.CWIDTH; x++) {
                charBuf.push(this.srcdata[startByte + x]);
            }
            startByte += bytesPerRastRow;
        }

        return charBuf;
    };

    this.findMatch = function (buf) {
        var smallestDiff = (this.CWIDTH * this.CHEIGHT) + 1; //Maximum Difference

        var bestMatch = undefined;

        for (var i = 0; i < this.CHARACTERS; i++) {
            var aDiff = this.diff(buf, this.chardata[i]);

            if (aDiff == 0)
                return i; //Perfect Match.

            if (aDiff < smallestDiff) {
                smallestDiff = aDiff;
                bestMatch = i;
            }
        }

        return bestMatch;
    };

    this.diff = function (bufa, bufb) {
        var difference = 0;

        for (var i = 0; i < bufa.length; i++) {
            if (bufa[i] != bufb[i])
                difference++;
        }

        return difference;
    };

    this.cloneCanvas = function (oldCanvas) {

        var newCanvas = document.createElement('canvas');
        var context = newCanvas.getContext('2d');
        newCanvas.width = oldCanvas.width;
        newCanvas.height = oldCanvas.height;
        context.drawImage(oldCanvas, 0, 0);

        return newCanvas;
    }


};


(function () {

    var c = new c64vdc({
        gap: 0.1,
        video: "A1.mp4"
    });

    c.startVideoFramesCapture()
    .then(function (data) {
        console.log(">>>Tutti i frames del video catturati", data);
        c.startPetsciiRender()
        .then(function (data) {
            console.log(">>> Tutti i frames elaborati e i codici petscii", data);
        })
    });


})();
