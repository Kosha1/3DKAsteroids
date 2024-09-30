//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
  
    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const width = 1;
    const height = 1;
    const border = 0;

    let srcFormat;
    let internalFormat;
    if (url.includes(".png")) {
        srcFormat = gl.RGBA;
        internalFormat = gl.RGBA;
    }
    if (url.includes(".jpeg")){
        srcFormat = gl.RGB;
        internalFormat = gl.RGB;
    }
    //const srcFormat = gl.RGBA;
    //const internalFormat = gl.RGBA;

    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel,
    );
  
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        srcFormat,
        srcType,
        image,
      );
  
      //TO DO: OUTDATED. WEBGL2 DOESN'T HAVE THIS POWER OF TWO REQUIREMENT TRY REMOVING THIS IF ELSE BLOCK
      // WebGL1 has different requirements for power of 2 images
      // vs. non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      /*
      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        // Yes, it's a power of 2. Generate mips.
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        // No, it's not a power of 2. Turn off mips and set
        // wrapping to clamp to edge
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      */
      gl.generateMipmap(gl.TEXTURE_2D);
      

    };
    image.src = url;
  
    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);//not needed since shader does (1 - texture coord) for y dir
    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function loadNullTex(gl){
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const level = 0;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGB;
    const internalFormat = gl.RGB;

    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([255, 255, 255, 255]); // white
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel,
    );

    return texture;
}

function loadNullNormalTex(gl){
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const level = 0;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGB;
  const internalFormat = gl.RGB;

  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]); //blue (up vector)
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

function loadSkybox(gl, faces){
    const cubemap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
    //for (var i = 0; i < faces.length; i++){
    faces.forEach((faceInfo)=>{
      const {target, url} = faceInfo;
  
      //prelim immediate texture setup so immediately renderable
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1024;
      const height = 1024;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      //const pixel = new Uint8Array([0, 0, 1023, 1023]); // opaque blue
  
      gl.texImage2D(target,
        level,internalFormat,width,height,border,srcFormat,srcType, null);
  
      //asynchronous image load
      const image = new Image();
      image.src = url;
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
        gl.texImage2D(target,
          level,internalFormat,width,height,border,srcFormat,srcType, image);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      }
    });
  
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  
    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return cubemap;
}

export {loadTexture, loadSkybox, loadNullTex, loadNullNormalTex};
  