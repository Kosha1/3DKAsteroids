import { initBuffers, initVAO, initSkyBoxBuffer, initSkyboxVAO } from "./init-buffers.js";
import { drawScene, drawSkybox } from "./draw-scene.js";
import { FPVCamera, ShipCamera } from "./camera.js";
import {Model, initModelShaderInfo, initDepthShaders} from "./model.js";
import { initShaderProgram, vsSource, fsSource, vsSkybox, fsSkybox, starDestVertexShader, starDestFragmentShader,
  instanceVS, VSLines, FSLines,
} from "./shaders.js";
import {loadTexture, loadSkybox} from "./loadimages.js";
import { AsteroidManager, initInstanceShaderInfo, initInstanceDepthShaderInfo } from "./asteroidmanager.js";
import { WorldManager } from "./worldmanager.js";
import { Ship } from "./ship.js";
import { BulletManager } from "./laserbullet.js";
import { Sphere } from "./sphere.js";
import { ExplosionManager } from "./explosion.js";
import { SoundManager } from "./soundmanager.js";

const canvas = document.querySelector("#glcanvas");
// Initialize the GL context
const gl = canvas.getContext("webgl2");
if (gl === null) {
  alert("Unable to initialize WebGL2. Your browser or machine may not support it.");
  throw new Error("Unable to initialize WebGL2");
}
gl.canvas.width = window.innerWidth;
gl.canvas.height = window.innerHeight;

//Relevant text tags from html doc found here
const fpsText = document.querySelector("#fps");
const AvgfpsElem = document.querySelector("#Avgfps");
const playerShipDist = document.querySelector("#dist");
const yawToShip = document.querySelector("#yawAngle");
const pitchToShip = document.querySelector("#pitchAngle");
const explCount = document.querySelector('#shipExp');
const speed = document.querySelector('#speed');
const astDestrCount = document.querySelector('#astDestr');
const upTime = document.querySelector('#upTime');
const paramRefreshRate = 0.2;//update info roughly every x seconds

const loadStatusText = document.getElementById("assetStatus")

//knockoff enums in javascript
const WindowState = Object.freeze({
  HOMESCREEN: Symbol("home"),
  PLAYSCREEN: Symbol("play"),
  OVERSCREEN: Symbol("over"),
});

let windowState = WindowState.HOMESCREEN;
//let windowState = WindowState.PLAYSCREEN;



let deltaTime = 0;

//Classes that listen for keys initialized here
const camera = new FPVCamera();
const shipCamera = new ShipCamera();
const bulletManager = new BulletManager(gl);
const soundManager = new SoundManager();

//Do not listen for keys but are needed for worldManager
const sphere = new Sphere(gl, 1, 36, 18, true);
const explosionTex = loadTexture(gl, "./textures/explosioncolors.png");
const explosionManager = new ExplosionManager(sphere, explosionTex);

//camera is passed by reference to worldManager's this.camera
const worldManager = new WorldManager(camera, shipCamera, bulletManager, explosionManager, soundManager);

document.addEventListener("keydown", (event)=>{
  if(!event.repeat && windowState == WindowState.PLAYSCREEN){
    camera.pressKey(event.key, soundManager);
  }
  if (!event.repeat && windowState != WindowState.HOMESCREEN){
    //camera.pressKey(event.key);
    shipCamera.pressKey(event.key);
    bulletManager.pressKey(event.key);
    worldManager.returnToHomeScreen(event.key);
  }
});
document.addEventListener("keyup", (event)=>{
  if (windowState == WindowState.PLAYSCREEN){
    camera.releaseKey(event.key, soundManager);
  }
  if (windowState != WindowState.HOMESCREEN){
    //camera.releaseKey(event.key);
    shipCamera.releaseKey(event.key);
    bulletManager.releaseKey(event.key);
  }
});

//Play Button And HTML DIVS for various screens
const playButton = document.querySelector('#playButton');
const HomeScreenDiv = document.getElementById("HomeScreen");
playButton.onclick = function(){
  if (worldManager.WorldReadiness){
    windowState = WindowState.PLAYSCREEN;
    HomeScreenDiv.style.display = "none";
    PlayScreenDiv.style.display = "block";
    worldManager.resetGame(true);

    //hide cursor
    document.body.style.cursor = "none";
  }
  //Audio AutoPlay Block: User pressed a button, audioContext can now be unsuspended
  if (soundManager.audioContext.state === "suspended"){
    soundManager.resumeAudioContext();
  }
}
const OverScreenDiv = document.getElementById("GameOverScreen");
//OverScreen HTML span locations
const FinalInfoHTML = {
  astCount : document.getElementById("finalAstCount"),
  finalTime: document.getElementById("finalTime"),
  finalScore: document.getElementById("finalScore"),
}

/* Uncomment if want to take screenshot of asteroids on full screen without any text
HomeScreenDiv.style.display = "none";
fpsText.style.display = "none";
*/
const PlayScreenDiv = document.getElementById("PlayScreen");
PlayScreenDiv.style.display = "none";//Hide play screen initially


main();

// start here
function main() {

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert(
      "Unable to initialize WebGL2. Your browser or machine may not support it."
    );
    return;
  }

  //Common shader for all models initialized/compiled once
  const modelShaders = initShaderProgram(gl, starDestVertexShader, starDestFragmentShader);
  const modelShaderInfo = initModelShaderInfo(gl, modelShaders);

  //Instanced Shader program
  const InstanceShader = initShaderProgram(gl, instanceVS, starDestFragmentShader);
  const InstanceShadInfo = initInstanceShaderInfo(gl, InstanceShader);
  const InstanceDepthInfo = initInstanceDepthShaderInfo(gl);

  //Lines Shader for Bounding Box
  const LineShader = initShaderProgram(gl, VSLines, FSLines);

  const depthShaderInfo = initDepthShaders(gl);
  //Model Loading
  var stardest;
  let stardestready = false;
  Model.loadGLTF(gl, modelShaderInfo, depthShaderInfo, "./models/StarDestroyerModel/", "scene.gltf").then((obj)=>{
    stardest = obj;//model class
    stardest.processScene();
    stardestready = true;

    const ship = new Ship(stardest, gl);//ship class
    worldManager.setStarDestroyer(ship);
  });

  let asteroids;
  let astready = false;
  //let AstManager;

  Model.loadGLTF(gl, modelShaderInfo, depthShaderInfo, "./models/AsteroidsModel/", "scene.gltf").then((obj)=>{
    asteroids = obj;
    asteroids.processScene();
    astready = true;
    const AstManager = new AsteroidManager(gl, 500, asteroids.meshes, InstanceShadInfo, InstanceDepthInfo);//was 500

    worldManager.setAsteroidManager(AstManager);

  });

  // Set clear color to black, fully opaque
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Clear the color buffer with specified clear color
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attribute our shader program is using
  // for aVertexPosition and look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      //vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
      textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
      modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
      uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),
    },
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);

  const vao = initVAO(gl, buffers, programInfo);

  // Load texture
  //const texture = loadTexture(gl, "./models/StarDestroyerModel/textures/Hullplates_baseColor.jpeg");
  //const texture = loadTexture(gl, "./models/StarDestroyerModel/textures/Hullplates_normal.jpeg");


  //Cockpit Image Overlay Setup
  const cockpitTex = loadTexture(gl, "./textures/cockpit_crop.png");
  const overlayShaderInfo = initOverlayShader(gl);
  const overlayBuffer = initScreenOverlayBuffer(gl);

  //Asteroid-Ship Radar Overlay Setup
  //const radarOverlayBuffer = initScreenOverlayBuffer(gl, 0.25, 0.3, 0.75, -0.7);
  const radarOverlayBuffer = initScreenOverlayBuffer(gl, 0.2, 0.25, 0.8, -0.75);
  const radarShaderInfo = initDepthOverlayShader(gl);

  //SKYBOX shaders, buffers, vao, textures
  const skyboxShaderProgram = initShaderProgram(gl, vsSkybox, fsSkybox);
  const skyboxProgramInfo = {
    program: skyboxShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(skyboxShaderProgram, "aPos")
    },
    uniformLocations:{
      projectionMatrix: gl.getUniformLocation(skyboxShaderProgram, "uProjectionMatrix"),
      viewMatrix: gl.getUniformLocation(skyboxShaderProgram, "uViewMatrix"),
      samplecube: gl.getUniformLocation(skyboxShaderProgram, "skybox")
    }
  }

  const skyboxbuffer = initSkyBoxBuffer(gl);
  const skyboxVAO = initSkyboxVAO(gl, skyboxbuffer, skyboxProgramInfo);

  const skyboxfaces = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: "./skybox/right.png"
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: "./skybox/left.png"
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: "./skybox/top.png"
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: "./skybox/bottom.png"
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: "./skybox/front.png"
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: "./skybox/back.png"
    },
  ]

  const cubemap = loadSkybox(gl, skyboxfaces);

  //Set the sunlight direction
  const sunlightdir = glMatrix.vec3.fromValues(1.0, 0.0, 0.0); //sun is at (-inf, 0, 0): light dir is opposite

  // Flip image pixels into the bottom-to-top order that WebGL expects.
  //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  //DEPTH FRAMEBUFFER CREATION
  const depthMapFBO = gl.createFramebuffer();
  const ShadowWidth = 1024, ShadowHeight = 1024;
  const depthMap = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depthMap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, ShadowWidth,
    ShadowHeight, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.bindFramebuffer(gl.FRAMEBUFFER, depthMapFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,       // target
    gl.DEPTH_ATTACHMENT,  // attachment point
    gl.TEXTURE_2D,        // texture target
    depthMap,         // texture
    0);
  
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);

  //Ship Radar Camera Frame and depth buffer creation
  const shipCamFBO = gl.createFramebuffer();
  const camWidth = 256, camHeight = 256;
  const shipRadarMap = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shipRadarMap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, camWidth,
    camHeight, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shipCamFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,       // target
    gl.DEPTH_ATTACHMENT,  // attachment point
    gl.TEXTURE_2D,        // texture target
    shipRadarMap,         // texture
    0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);


  gl.bindFramebuffer(gl.FRAMEBUFFER, null);//use null to bind to the HTML canvas element
  


  //Average FPS Variables
  const frameTimes = [];
  let   frameCursor = 0;
  let   numFrames = 0;   
  const maxFrames = 20;
  let   totalFPS = 0;


  let then = 0;
  let timeSinceParamUpdate = 0.0;

  let secondsElapsed = 0;
  let minutesElapsed = 0;

  //gl.enable(gl.CULL_FACE);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Draw the scene repeatedly
  function render(now) {
    //check if worldManager Assets are loaded. If so change text if needed
    if (loadStatusText.textContent != "Game Assets Ready" && worldManager.WorldReadiness){
      loadStatusText.textContent = "Game Assets Ready";
    }

    resizeCanvasToDisplaySize(gl.canvas);

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things
  
    //Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    now *= 0.001; // convert to seconds
    deltaTime = now - then;
    then = now;

    let framerate = 1 / deltaTime;
    let text = "Frame rate: " + framerate.toFixed(1).toString();
    //fpsElem.textContent = text;

    //AVERAGE FPS STUFF
    // add the current fps and remove the oldest fps
    totalFPS += framerate - (frameTimes[frameCursor] || 0);
    // record the newest fps
    frameTimes[frameCursor++] = framerate;
    // needed so the first N frames, before we have maxFrames, is correct.
    numFrames = Math.max(numFrames, frameCursor);
    // wrap the cursor
    frameCursor %= maxFrames;
    const averageFPS = totalFPS / numFrames;
    let avgtext = averageFPS.toFixed(1).toString();
    AvgfpsElem.textContent = avgtext;

    //RENDERING
    //camera.updateCamera(deltaTime);//Camera should be updated in the worldManager

    //drawScene(gl, programInfo, vao, texture, camera, cubeRotation);
    //drawScene(gl, programInfo, vao, depthMap, camera, cubeRotation);
    //drawScene(gl, programInfo, vao, shipRadarMap, camera, cubeRotation);

    //if (worldManager.WorldReadiness){
    if(worldManager.WorldReadiness && windowState == WindowState.HOMESCREEN){
      gl.viewport(0, 0, ShadowWidth, ShadowHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, depthMapFBO);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      worldManager.renderDepthHomeScreen();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);//arbitrary size canvas
      worldManager.drawHomeScreen(sunlightdir, depthMap);
      worldManager.updateHomeScreen(deltaTime);
    }
    else if (worldManager.WorldReadiness && windowState == WindowState.PLAYSCREEN){
      //Check if need to update Player to Ship Parameters
      timeSinceParamUpdate += deltaTime;
      secondsElapsed += deltaTime;
      if (timeSinceParamUpdate >= paramRefreshRate){
        timeSinceParamUpdate = 0.0;
        const paramInfo = worldManager.getPlayerShipCoords();
        playerShipDist.textContent = paramInfo[0].toString();
        yawToShip.textContent = paramInfo[1].toString();
        pitchToShip.textContent = paramInfo[2].toString();

        explCount.textContent = worldManager.getShipExplCount().toString();
        speed.textContent = camera.getSpeedText();
        astDestrCount.textContent = worldManager.getDestroyedAstCount().toString();

        //Up Time Display
        if (secondsElapsed > 59){
          secondsElapsed = 0;
          minutesElapsed += 1;
        }
        upTime.textContent = minutesElapsed.toString().padStart(2, '0') + ":" + Math.floor(secondsElapsed).toString().padStart(2, '0');

      }

      //Render to framebuffer from perspective of sun
      gl.viewport(0, 0, ShadowWidth, ShadowHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, depthMapFBO);
      gl.clear(gl.DEPTH_BUFFER_BIT);//clear depth buffer since we need same dpeth buffer for all models

      worldManager.renderDepth();

      //Render to framebuffer of Ship Asteroid Radar
      gl.viewport(0, 0, camWidth, camHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, shipCamFBO);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      worldManager.renderDepth(true);//true since we need to use shipCamera object


      //normal drawing
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      //gl.viewport(0, 0, 960, 720);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);//arbitrary size canvas

      worldManager.draw(sunlightdir, depthMap);

      //drawBoundBox(gl, LineShader, camera, worldManager.AstManager, worldManager.AstManager.numAsteroids);
      //drawBoundBox(gl, LineShader, camera, worldManager.StarDestroyer, worldManager.StarDestroyer.numMeshes - 1);

      //update all asteroid states
      //AstManager.updateMatrixArrays(deltaTime);
      worldManager.updateState(deltaTime);
      if (worldManager.isGameOver()){
        windowState = WindowState.OVERSCREEN;

        explCount.textContent = worldManager.getShipExplCount().toString();//final update of numShipExplosions text
        fpsText.style.color = "black";//so you can see fps counter in the yellow explosion background
        //Set relevent OverScreen Text Information
        FinalInfoHTML.astCount.textContent = worldManager.getDestroyedAstCount().toString();
        FinalInfoHTML.finalTime.textContent =
          minutesElapsed.toString().padStart(2, '0') + ":" + Math.floor(secondsElapsed).toString().padStart(2, '0');
        const score = 5 * worldManager.getDestroyedAstCount() + Math.floor(secondsElapsed) + 60 * minutesElapsed;
        FinalInfoHTML.finalScore.textContent = score.toString();

        minutesElapsed = 0;
        secondsElapsed = 0;
      }
    }
    else if (worldManager.WorldReadiness && windowState == WindowState.OVERSCREEN){
      if (worldManager.isPlayerCrashed()){
        worldManager.drawPlayerCrashed();
        OverScreenDiv.style.display = "block";
        PlayScreenDiv.style.display = "none";

        worldManager.updateState(deltaTime);

        //Exiting the OverScreen to the HomeScreen
        if(worldManager.shouldExit()){
          windowState = WindowState.HOMESCREEN;
          worldManager.resetGame();
          worldManager.setExitFalse();
          OverScreenDiv.style.display = "none";//hide Gameover html
          HomeScreenDiv.style.display = "block";//show HomeScreen html

          fpsText.style.color = "white";

          //show cursor again
          document.body.style.cursor = "auto";
        }
      }
      else{
        gl.viewport(0, 0, ShadowWidth, ShadowHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthMapFBO);
        gl.clear(gl.DEPTH_BUFFER_BIT);//clear depth buffer since we need same dpeth buffer for all models
        worldManager.renderDepth();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);//arbitrary size canvas
        worldManager.draw(sunlightdir, depthMap);
        worldManager.updateState(deltaTime);
      }
    }

    drawSkybox(gl, skyboxProgramInfo, skyboxVAO, cubemap, camera);

    if (windowState == WindowState.PLAYSCREEN){
      drawOverlayImage(gl, overlayShaderInfo, overlayBuffer, cockpitTex);
      drawOverlayImage(gl, radarShaderInfo, radarOverlayBuffer, shipRadarMap);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function resizeCanvasToDisplaySize(canvas) {
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;
 
  // Check if the canvas is not the same size.
  const needResize = canvas.width  !== displayWidth ||
                     canvas.height !== displayHeight;
  if (needResize) {
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
  return needResize;
}


function drawBoundBox(gl, shader, camera, astMan, numCubes){
  gl.bindVertexArray(null);//this step is essential. Probably should detach vao in other draw calls later

  //Projection Matrix
  const fieldOfView = (45 * Math.PI) / 180; // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = glMatrix.mat4.create();
  glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  gl.useProgram(shader);
  gl.uniformMatrix4fv(gl.getUniformLocation(shader, "uProjectionMatrix"), false, projectionMatrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(shader, "uViewMatrix"), false, camera.getViewMatrix());

  gl.bindBuffer(gl.ARRAY_BUFFER, astMan.AABBBuff);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, astMan.AABBIndexBuff);

  //gl.drawElements(gl.LINES, 24 * astMan.numAsteroids, gl.UNSIGNED_SHORT, 0);
  gl.drawElements(gl.LINES, 24 * numCubes, gl.UNSIGNED_SHORT, 0);
}

function initOverlayShader(gl){
  const VS = `#version 300 es
    layout (location = 0) in highp vec2 Pos;//NDC coordinates
    layout (location = 1) in highp vec2 tex;
    out highp vec2 TexCoords;
    void main() {
      TexCoords = vec2(tex.x, 1.0 - tex.y);//flip y tex coords
      gl_Position = vec4(Pos.x, Pos.y, 0.0, 1.0);
    }
    `;
  const FS = `#version 300 es
    in highp vec2 TexCoords;
    uniform sampler2D Image;
    out highp vec4 fragColor;
    void main() {
        highp vec4 texColor = texture(Image, TexCoords);
        if (texColor.a < 0.9)
          discard;
        fragColor = texColor;
    }
    `;

  const shader = initShaderProgram(gl, VS, FS);
  return {
      program: shader,
      PosLoc: 0,
      TexLoc: 1,
      ImageLoc: gl.getUniformLocation(shader, "Image"),
  }
}

function initDepthOverlayShader(gl){
  const VS = `#version 300 es
    layout (location = 0) in highp vec2 Pos;//NDC coordinates
    layout (location = 1) in highp vec2 tex;
    out highp vec2 TexCoords;
    void main() {
      TexCoords = tex;//depth texture is already in proper orientation; don't flip y texCoord
      gl_Position = vec4(Pos.x, Pos.y, 0.0, 1.0);
    }
    `;
    const FS = `#version 300 es
    in highp vec2 TexCoords;
    uniform sampler2D Image;
    out highp vec4 fragColor;
    void main() {
      highp float depthValue = texture(Image, TexCoords).r;
      
      if (depthValue == 1.0)
        discard;
      
      
      //fragColor = vec4(vec3(depthValue), 1.0);
      fragColor = vec4(1.0, depthValue, depthValue, 1.0);
    }
    `;
    const shader = initShaderProgram(gl, VS, FS);
    return {
        program: shader,
        PosLoc: 0,
        TexLoc: 1,
        ImageLoc: gl.getUniformLocation(shader, "Image"),
    }
}

//SCALE SHOULD ALWAYS BE <= 1.0
function initScreenOverlayBuffer(gl, scaleX = 1.0, scaleY = 1.0, xCenter = 0.0, yCenter = 0.0){
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  const data = [
    // positions                              // texCoords
    -1.0*scaleX + xCenter, 1.0*scaleY + yCenter, 0.0, 1.0,
    -1.0*scaleX + xCenter, -1.0*scaleY + yCenter, 0.0, 0.0,
    1.0*scaleX + xCenter, -1.0*scaleY + yCenter, 1.0, 0.0,
    -1.0*scaleX + xCenter, 1.0*scaleY + yCenter, 0.0, 1.0,
    1.0*scaleX + xCenter, -1.0*scaleY + yCenter, 1.0, 0.0,
    1.0*scaleX + xCenter, 1.0*scaleY + yCenter, 1.0, 1.0
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buffer;
}

function drawOverlayImage(gl, shaderInfo, buffer, texture){
  gl.bindVertexArray(null);
  gl.disable(gl.DEPTH_TEST);//overlay image should not write and check to depth buffer

  gl.useProgram(shaderInfo.program);

  //texture binding
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(shaderInfo.ImageLoc, 3);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(shaderInfo.PosLoc, 2, gl.FLOAT, false, 4*4, 0);//4 floats * 4 bytes each
  gl.enableVertexAttribArray(shaderInfo.PosLoc);
  gl.vertexAttribPointer(shaderInfo.TexLoc, 2, gl.FLOAT, false, 4*4, 2*4);
  gl.enableVertexAttribArray(shaderInfo.TexLoc);

  gl.drawArrays(gl.TRIANGLES, 0, 6);//2 triangles
  gl.enable(gl.DEPTH_TEST);//reenable depth test

}