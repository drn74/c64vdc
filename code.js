(function () {

    var c64vdc = {};

    c64vdc.counter = 0;
    c64vdc.video = document.createElement("video");
    c64vdc.thumbs = document.getElementById("thumbs");
    c64vdc.frames = [];
    c64vdc.gap = 0.1; //0.33;

    c64vdc.CHARSET = "chars"
    c64vdc.CHARACTERS = 256;
    c64vdc.WIDTH = 320;
    c64vdc.HEIGHT = 200;
    c64vdc.CWIDTH = 8;
    c64vdc.CHEIGHT = 8;
    
    c64vdc.canvas;
    c64vdc.source;
    c64vdc.context;
    c64vdc.character;
    
    c64vdc.chardata = [];
    c64vdc.srcdata  = [];
    c64vdc.petscii  = new Uint8Array( (c64vdc.WIDTH/c64vdc.CWIDTH) * (c64vdc.HEIGHT/c64vdc.CHEIGHT) );
    
    c64vdc.characterContainer;
    c64vdc.characterCanvas = [];

    c64vdc.video.preload = "auto";
    c64vdc.video.src = "A1.mp4";

    c64vdc.video.addEventListener('loadeddata', function () {
        c64vdc.thumbs.innerHTML = "";
        c64vdc.video.currentTime = c64vdc.counter;
    }, false);

    c64vdc.video.addEventListener('seeked', function () {
        c64vdc.generateThumbnail();

        c64vdc.counter += c64vdc.gap;

        if (c64vdc.counter <= c64vdc.video.duration) {
            c64vdc.video.currentTime = c64vdc.counter;
        }
        else {
            // DONE
            console.log("done!");
            c64vdc.showFrames();
            c64vdc.startRender();
        }

    }, false);

    c64vdc.generateThumbnail = function () {
        var c = document.createElement("canvas");
        var ctx = c.getContext("2d");
        c.width = 320;
        c.height = 200;
        ctx.drawImage(c64vdc.video, 0, 0, 320, 200);

        var image = new Image();
        image.crossOrigin = "anonymous";
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = c.toDataURL("image/png");
        c64vdc.frames.push(image);

        c64vdc.thumbs.innerHTML = c64vdc.counter;
    }

    c64vdc.showFrames = function () {
        c64vdc.thumbs.innerHTML = "";
        for (var k = 0; k < c64vdc.frames.length; k++) {
            c64vdc.thumbs.appendChild(c64vdc.frames[k]);
        }
    }  

    c64vdc.greyscale = function(ctx, w, h, skip) {
        var imgd = ctx.getImageData(0, 0, w, h);
        var pix  = imgd.data;
        
        var x = 0;
        var y = 0;
        
        var id = ctx.createImageData(1, 1);
        var d  = id.data;
        
        var ebBuf = [];
        
        for(var i = 0, il = pix.length; i < il; i += 4 ) {
            var grayscale = pix[i] * .3  + pix[i+1] * .59 +  pix[i+2] * .11;

            //Weight the alpha channel. --Thanks to Chris Roy!
            var aDiff = 256 - pix[i+3];
            var gDiff = 256 - grayscale;

            grayscale = (gDiff * aDiff / 256) + grayscale;

            ebBuf.push(grayscale);
        }

        if(!skip) {
            c64vdc.dither(ebBuf, w, h);
        
            for(var i=0; i<ebBuf.length; i++) {
                d[0]   = ebBuf[i];
                d[1]   = ebBuf[i];
                d[2]   = ebBuf[i];
                d[3]   = 255;
                ctx.putImageData(id,x,y);				

                x++;
                if(x >= c64vdc.WIDTH) {
                    x = 0
                    y++;
                }
            }
        }
        
        return ebBuf;
    };

    c64vdc.dither = function(sb, w, h) {   // source buffer, width, height
        for(var i=0; i<h; i++) {
            for(var j=0; j<w; j++) {
                var ci = i*w+j;               // current buffer index
                var cc = sb[ci];              // current color
                var rc = (cc<128?0:255);      // real (rounded) color
                var err = cc-rc;              // error amount

                sb[ci] = rc;                  // saving real color

                if(j+1 < w) {
                    sb[ci  +1] += (err*7)>>4;  // if right neighbour exists
                }

                if(i+1 == h) continue;   // if we are in the last line

                if(j > 0) {
                    sb[ci+w-1] += (err*3)>>4;  // bottom left neighbour
                }

                sb[ci+w] += (err*5)>>4;  // bottom neighbour

                if(j+1 < w) { 
                    sb[ci+w+1] += (err*1)>>4;  // bottom right neighbour
                }
            }
        }
    };

    c64vdc.render = function() {
        var charsWide = c64vdc.WIDTH  / c64vdc.CWIDTH;
        var charsHigh = c64vdc.HEIGHT / c64vdc.CHEIGHT;
    
        var charCount = charsWide * charsHigh;
        
        var c = 0;
        for(var y=0; y < charsHigh; y++) {
            for(var x=0; x < charsWide; x++) {
                var charBuf  = c64vdc.getSourceChar(c);
                var petValue = c64vdc.findMatch(charBuf);
            
                c64vdc.petscii[c] = petValue;
                
                c64vdc.context.drawImage(c64vdc.characterCanvas[petValue], x*c64vdc.CWIDTH, y*c64vdc.CHEIGHT);
                c++;
            }
        }
    };

    c64vdc.getSourceChar = function(c) {
        var charsWide = (c64vdc.WIDTH  / c64vdc.CWIDTH);
        
        var bytesPerRastRow = c64vdc.CWIDTH * charsWide
        var bytesPerCharRow = c64vdc.CHEIGHT * bytesPerRastRow;
        
        var startByte = 0;
        while(c > charsWide) {
            startByte += bytesPerCharRow;
            c -= charsWide;
        }
        
        while(c) {
            startByte += c64vdc.CWIDTH;
            c--;
        }
        
        var charBuf = [];
        for(var y=0; y < c64vdc.CHEIGHT; y++) {
            for(var x=0; x < c64vdc.CWIDTH; x++) {
                charBuf.push(c64vdc.srcdata[startByte+x]);
            }
            startByte += bytesPerRastRow;
        }
        
        return charBuf;
    };

    c64vdc.findMatch = function(buf) {
        var smallestDiff = (c64vdc.CWIDTH * c64vdc.CHEIGHT) + 1; //Maximum Difference
        
        var bestMatch = undefined;
        
        for(var i=0; i < c64vdc.CHARACTERS; i++) {
            var aDiff = c64vdc.diff(buf, c64vdc.chardata[i]);
            
            if(aDiff == 0)
                return i; //Perfect Match.
            
            if(aDiff < smallestDiff) {
                smallestDiff = aDiff;
                bestMatch = i;
            }
        }
        
        return bestMatch;
    };

    c64vdc.diff = function(bufa, bufb) {
        var difference = 0;

        for(var i=0; i < bufa.length; i++) {
            if(bufa[i] != bufb[i])
                difference++;
        }
        
        return difference;
    };

    c64vdc.cloneCanvas = function(oldCanvas) {
        
        //create a new canvas
        var newCanvas = document.createElement('canvas');
        var context = newCanvas.getContext('2d');
    
        //set dimensions
        newCanvas.width = oldCanvas.width;
        newCanvas.height = oldCanvas.height;
    
        //apply the old canvas to the new one
        context.drawImage(oldCanvas, 0, 0);
    
        //return the new canvas
        return newCanvas;
    }

    c64vdc.startRender = function() {

        for(var i = 0; i < c64vdc.CHARACTERS; i++) {
            var charCanvas = document.createElement("canvas");
            c64vdc.characterCanvas.push(charCanvas);
        }

        c64vdc.character = document.getElementById("character");

        var i = 0;
        c64vdc.character.onload = function() {

            var charCanvas  = c64vdc.characterCanvas[i];
            var charContext = charCanvas.getContext("2d");
            
            charContext.drawImage(character,0,0);
            
            var pxbuf = c64vdc.greyscale(charContext, c64vdc.CWIDTH, c64vdc.CHEIGHT, true); //Skip Dither
            
            for(var px=0; px < pxbuf.length; px++) {
                if(pxbuf[px] < 128)
                    pxbuf[px] = 0;
                else
                    pxbuf[px] = 255;
            }

            c64vdc.chardata[i] = pxbuf;
            i++;
            loadCharacter();
        };

        var loadCharacter = function() {
            if(i >= c64vdc.CHARACTERS) {

                var myc = document.getElementById('mycontainer');
                c64vdc.canvas = document.getElementById('canvas');
                c64vdc.context = c64vdc.canvas.getContext("2d");

                for (var k = 0; k < c64vdc.frames.length; k++) {
                    c64vdc.source = c64vdc.frames[k]; //document.getElementById('source');
                    c64vdc.context.drawImage(c64vdc.source, 0, 0, c64vdc.WIDTH, c64vdc.HEIGHT);
                    c64vdc.srcdata = c64vdc.greyscale(c64vdc.context, c64vdc.WIDTH, c64vdc.HEIGHT);
                    c64vdc.render();
                    myc.appendChild(c64vdc.cloneCanvas(c64vdc.canvas));
                    console.log(c64vdc.petscii);
                }

                return;
            }
            c64vdc.character.src = c64vdc.CHARSET + "/" + i + ".gif";
        };
        
        loadCharacter();
    }

})();

