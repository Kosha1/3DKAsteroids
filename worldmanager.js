import { getRandomArbitrary, getRandomInt} from "./asteroidmanager.js";


class WorldManager{
        #gameOver;//Bool to keep track of game state
        #playerActive;
        #numShipExplosions;
        #numAstDestroyed;
        #exitToHome = false;

        //Collection of variables needed for game over ship explosion
        #finalShipExplParams = {
            MaxExplosions: 10,
            timeBetweenExpl: 2,
            runningTime: 0,
            currentNumExpl: 0,
        };
        #finalShipSoundParams = {
            startFailureSound : true,
            startFinalBang : true,
        };

    constructor(cameraRef, shipCam, bulletMan, explMan, soundMan){
        this.#playerActive = true;//player has not crashed
        this.#numShipExplosions = 0;
        this.#numAstDestroyed = 0;
        this.#gameOver = false;

        this.BulletManager = bulletMan;
        this.ExplosionManager = explMan;
        this.SoundManager = soundMan;

        this.camera = cameraRef;//This is a pass by reference to camera object created in the main js file
        this.shipCamera = shipCam;

        this.AstManReady = false;
        this.StarDestReady = false;

        this.WorldReadiness = false;//General boolean that will be true after all managed items become ready

        this.numAxisCells = 8;//grid will be a cube with all axes having same number of cells
        this.cellWidth = 30;//dimension of individual cell cube

        this.gridCenter = glMatrix.vec3.fromValues(0.0, 0.0, 0.0);

        //3D Array will just be viewed as 1d with indexing being [x*l^2 + y*l + z] instead of [x][y][z]
        this.cellGrid = new Array(this.numAxisCells * this.numAxisCells * this.numAxisCells);
        for(let i = 0; i < this.cellGrid.length; ++i){
            this.cellGrid[i] = [];//init cellGrid to array of empty arrays
        }

        this.#updateMinMaxBounds();

    }

    setAsteroidManager(astMan){
        this.AstManager = astMan;

        //this.#updateCellGrid(true);//true since start of new Game when astManager is initialized
        this.#updateCellGrid();

        this.AstManReady = true;
        this.#checkReadiness();
    }
    setStarDestroyer(ship){
        this.StarDestroyer = ship;
        this.StarDestReady = true;
        this.#checkReadiness();
    }
    #checkReadiness(){
        if (this.AstManReady && this.StarDestReady) this.WorldReadiness = true;
    }

    resetGame(awayFromCenter = false){
        this.AstManager.resetAsteroids();
        this.ExplosionManager.resetExplosions();
        this.BulletManager.resetBullets();
        this.camera.resetCamera();

        this.#updateCellGrid(awayFromCenter);//ensure no asteroids are next to ship at start

        //reset the finalShipExpParams
        this.#finalShipExplParams.currentNumExpl = 0;
        this.#finalShipExplParams.runningTime = 0;
        this.#finalShipExplParams.timeBetweenExpl = 2;

        this.#finalShipSoundParams.startFailureSound = true;
        this.#finalShipSoundParams.startFinalBang = true;

        this.#numShipExplosions = 0;
        this.#numAstDestroyed = 0;
        this.#playerActive = true;
        this.#gameOver = false;

    }

    returnToHomeScreen(key){
        if (key == "Escape" && this.#gameOver && !this.#playerActive){
            this.#exitToHome = true;
        }
    }


    renderDepth(shipRadar = false){//Relay Function to draw all managed items
        if(!shipRadar){//regular shadow mapping
            this.AstManager.renderDepth(this.StarDestroyer.getWorldPos());
            this.StarDestroyer.renderDepth();
        }
        else{
            this.AstManager.renderDepth(this.StarDestroyer.getWorldPos(), this.shipCamera);
            this.StarDestroyer.renderDepth(this.shipCamera);
        }
    }

    draw(sunlightdir, depthMap){//Relay Function to draw all managed items
        this.AstManager.draw(this.camera, sunlightdir, depthMap);
        this.StarDestroyer.draw(this.camera, sunlightdir, depthMap);

        this.BulletManager.draw(this.camera);

        this.ExplosionManager.draw(this.camera);
    }

    //Game Over Draw State if player crashes into asteroid or ship
    drawPlayerCrashed(){
        this.ExplosionManager.draw(this.camera);
    }

    //Home Screen Draw State (just asteroids flying around)
    renderDepthHomeScreen(){
        this.AstManager.renderDepth(this.StarDestroyer.getWorldPos());
    }
    drawHomeScreen(sunlightdir, depthMap){
        this.AstManager.draw(this.camera, sunlightdir, depthMap);
    }
    updateHomeScreen(deltaTime){
        this.AstManager.update(deltaTime);
        this.#updateCellGrid();
    }

    updateState(deltaTime){//Relay Function to update all managed items
        if (!this.#gameOver){//Regular active game state
            //NOTE: the this.camera object is the same object as the one in main file(accessed by reference))
            this.camera.updateCamera(deltaTime, this.SoundManager);
            this.shipCamera.updateCamera(this.StarDestroyer.getWorldPos());

            this.AstManager.update(deltaTime);
            this.StarDestroyer.update(deltaTime);

            /* No need to change the grids if starDest is not moving
            this.#updateGridCenter(this.StarDestroyer.getWorldPos());
            this.#updateMinMaxBounds();//needed if grid Center changes
            */

            this.#updateCellGrid();

            this.BulletManager.update(this.camera, deltaTime, this.SoundManager);//BulletManager handles new laserblasts
            this.ExplosionManager.update(deltaTime);

            //All Collision Check functions
            //this.#checkAstAstCollisions();//currently no need for function (just wastes cpu resources)
            this.#checkShipPlayerCollision();
            this.#checkPlayerAstCollision();
            this.#checkAstShipCollision();
            this.#checkAstLaserCollisions();

            if (this.#numShipExplosions >= 2){//player is still alive but ship sustained too many asteroid hits =>game over
                //this.#playerActive = false;
                this.#gameOver = true;
                //Set Camera to fixed position overlooking the ship
                const finalPos = glMatrix.vec3.create();
                const finalQuat = glMatrix.quat.create();
                glMatrix.quat.setAxisAngle(finalQuat, [0.0, 1.0, 0.0], Math.PI / -6);
                glMatrix.vec3.add(finalPos, this.StarDestroyer.getWorldPos(), [-8.0, 2.0, 15.0]);
                this.camera.setPosition(finalPos);
                this.camera.setQuat(finalQuat);
            }
            
            this.SoundManager.playAmbientEngine();
        }
        else if (this.#playerActive){//Star Destroyer Must Be Exploded
            this.SoundManager.stopAccelSound();
            this.SoundManager.stopDecelSound();
            this.SoundManager.stopAmbientEngine();

            //Multiple permanent explosions must be created on ship
            this.#finalShipExplParams.runningTime += deltaTime;
            if (this.#finalShipExplParams.currentNumExpl < this.#finalShipExplParams.MaxExplosions
                    && this.#finalShipExplParams.runningTime >= this.#finalShipExplParams.timeBetweenExpl){
                this.#finalShipExplParams.currentNumExpl++;
                this.#finalShipExplParams.runningTime = 0;
                this.#finalShipExplParams.timeBetweenExpl = getRandomArbitrary(0.5, 1.0);
                //create permanent explosion on ship
                const randShipPoint = this.StarDestroyer.getRandomShipVertex();
                const randExplMaxScale = getRandomArbitrary(0.5, 1.5);
                //const randExplMaxScale = 0.1;
                this.ExplosionManager.createExplosion(randShipPoint, 0.05, true, true, randExplMaxScale);
                //this.SoundManager.playAstExplosion(10);//don't make sound too loud

                //When currentNumExpl == MaxExplosions, make one enlarging explosion at the center of the ship
                if (this.#finalShipExplParams.currentNumExpl == this.#finalShipExplParams.MaxExplosions){
                    this.ExplosionManager.createExplosion(this.StarDestroyer.getWorldPos(), 0.2, true, true, 14);//permanent & enlarging
                    if(this.#finalShipSoundParams.startFinalBang){
                        this.SoundManager.playFinalShipExplosion();
                        this.#finalShipSoundParams.startFinalBang = false;
                    }
                }

                //Play the sound of the ship collapse (not at very start since sound length is too short)
                if (this.#finalShipExplParams.currentNumExpl == 2){
                    if (this.#finalShipSoundParams.startFailureSound){
                        this.#finalShipSoundParams.startFailureSound = false;
                        this.SoundManager.playShipFailureSound();
                    }
                }
            }

            //After x seconds end the showing of the ship
            if (this.#finalShipExplParams.runningTime > 6){
                this.#playerActive = false;//change of variable to go to player death screen after ship already engulfed in fire
                const playerPos = this.camera.getPosition();
                this.ExplosionManager.createExplosion(playerPos, 0.3, true);//permanent explosion at center of viewer
            }

            this.AstManager.update(deltaTime);
            this.StarDestroyer.update(deltaTime);
            this.ExplosionManager.update(deltaTime);

            this.#updateCellGrid();
            this.#checkAstShipCollision();

        }
        else{//Player Must Be Exploded
            this.ExplosionManager.update(deltaTime);
            this.SoundManager.stopAccelSound();
            this.SoundManager.stopDecelSound();
            this.SoundManager.stopAmbientEngine();
        }
    }

    getShipExplCount(){return this.#numShipExplosions;}
    getDestroyedAstCount(){return this.#numAstDestroyed;}
    isGameOver(){return this.#gameOver;}
    shouldExit(){return this.#exitToHome;}
    setExitFalse(){this.#exitToHome = false;}
    isPlayerCrashed(){return (this.#gameOver && !this.#playerActive);}

    getPlayerShipCoords(){
        const shipPos = this.StarDestroyer.getWorldPos();
        const playerPos = this.camera.getPosition();
        //These are normalized in the camera class functions
        const rightVector = this.camera.getRightVec();
        const forwardVector = this.camera.getForwardVec();
        const upVector = this.camera.getUpVec();

        const playerToShip = glMatrix.vec3.create();
        glMatrix.vec3.subtract(playerToShip, shipPos, playerPos);

        //Project the playerToShip Vector onto the plane formed by the right and forward vectors
        const forwardRightProj = glMatrix.vec3.create();
        const upVecScale = glMatrix.vec3.dot(playerToShip, upVector);
        glMatrix.vec3.scaleAndAdd(forwardRightProj, playerToShip, upVector, -1 * upVecScale);

        //solution based on atan2 solution on stack overflow "signed angle between 2 3d vectors..."
        //finding the signed angle between the forward vector and proj vector
        const cross = glMatrix.vec3.create();
        glMatrix.vec3.cross(cross, forwardVector, forwardRightProj);
        const y = glMatrix.vec3.dot(cross, upVector);
        const x = glMatrix.vec3.dot(forwardVector, forwardRightProj);
        const yawAngle = Math.round((Math.atan2(y, x) * 180) / Math.PI);

        //finding the signed angle between the forwardRightProj vector and the playerToShip vector
        let pitchAngle = 0;
        if (!glMatrix.vec3.equals(forwardRightProj, playerToShip)){
            const angle = (glMatrix.vec3.angle(forwardRightProj, playerToShip) * 180)/ Math.PI;
            pitchAngle = Math.round(Math.sign(glMatrix.vec3.dot(upVector, playerToShip)) * angle);
        }

        const distance = Math.round(glMatrix.vec3.distance(playerPos, shipPos));

        return [distance, yawAngle, pitchAngle];

    }

    #blankCellGrid(){
        for(let i = 0; i < this.cellGrid.length; ++i){
            if (this.cellGrid[i].length != 0) this.cellGrid[i].length = 0;
        }
    }

    #updateGridCenter(newCenter){glMatrix.vec3.copy(this.gridCenter, newCenter);}

    //minimum and maximum x, y, z, values of grid based on the gridCenter
    #updateMinMaxBounds(){
        this.minX = this.gridCenter[0] - (this.cellWidth * this.numAxisCells / 2);
        this.maxX = this.gridCenter[0] + (this.cellWidth * this.numAxisCells / 2);
        this.minY = this.gridCenter[1] - (this.cellWidth * this.numAxisCells / 2);
        this.maxY = this.gridCenter[1] + (this.cellWidth * this.numAxisCells / 2);
        this.minZ = this.gridCenter[2] - (this.cellWidth * this.numAxisCells / 2);
        this.maxZ = this.gridCenter[2] + (this.cellWidth * this.numAxisCells / 2);
    }

    //send an asteroid to an edge of the cell grid
    #teleportAstToEdge(astRef){//reference to the asteroid: modify velocity dir and position
        const edge = getRandomInt(0, 6);

        const edgeOffset = getRandomArbitrary(2.0, this.cellWidth);
        const xBearing = getRandomArbitrary(this.gridCenter[0] - this.cellWidth*2, this.gridCenter[0] + this.cellWidth*2);
        const yBearing = getRandomArbitrary(this.gridCenter[1] - this.cellWidth*2, this.gridCenter[1] + this.cellWidth*2);
        const zBearing = getRandomArbitrary(this.gridCenter[2] - this.cellWidth*2, this.gridCenter[2] + this.cellWidth*2);
        const bearing = glMatrix.vec3.fromValues(xBearing, yBearing, zBearing);//heading roughly to the center of the grid

        let xPos, yPos, zPos;
        switch (edge){
            case 0://min X
                xPos = this.minX + edgeOffset;
                yPos = getRandomArbitrary(this.minY, this.maxY);
                zPos = getRandomArbitrary(this.minZ, this.maxZ);
                break;
            case 1://max X
                xPos = this.maxX - edgeOffset;
                yPos = getRandomArbitrary(this.minY, this.maxY);
                zPos = getRandomArbitrary(this.minZ, this.maxZ);
                break;
            case 2://min Y
                yPos = this.minY + edgeOffset;
                xPos = getRandomArbitrary(this.minX, this.maxX);
                zPos = getRandomArbitrary(this.minZ, this.maxZ);
                break;
            case 3://max Y
                yPos = this.maxY - edgeOffset;
                xPos = getRandomArbitrary(this.minX, this.maxX);
                zPos = getRandomArbitrary(this.minZ, this.maxZ);
                break;
            case 4://min Z
                zPos = this.minZ + edgeOffset;
                xPos = getRandomArbitrary(this.minX, this.maxX);
                yPos = getRandomArbitrary(this.minY, this.maxY);
                break;
            case 5://max Z
                zPos = this.maxZ - edgeOffset;
                xPos = getRandomArbitrary(this.minX, this.maxX);
                yPos = getRandomArbitrary(this.minY, this.maxY);
                break;
            default:
                console.log("Teleporting asteroid: random edge failed");
        }
        const newPos = glMatrix.vec3.fromValues(xPos, yPos, zPos);
        const velocityDir = glMatrix.vec3.create();
        glMatrix.vec3.subtract(velocityDir, bearing, newPos);
        glMatrix.vec3.normalize(velocityDir, velocityDir);

        astRef.setPosition(newPos);
        astRef.setVelocityDir(velocityDir);
    }

    #checkAstAstCollisions(){//Asteroid vs Asteroid Collision
        for (let i = 0; i < this.cellGrid.length; ++i){//extract one cell in the grid
            const AstCount = this.cellGrid[i].length;//Number of asteroids in this cell

            //Avoid any further checks if less than two asteroids
            if (AstCount < 2) continue;

            //pairwise check the asteroids in the cell for collision
            for (let a = 0; a < AstCount - 1; ++a){
                for(let b = a + 1; b < AstCount; ++b){
                    const Amax = this.cellGrid[i][a].getMax();
                    const Amin = this.cellGrid[i][a].getMin();
                    const Bmax = this.cellGrid[i][b].getMax();
                    const Bmin = this.cellGrid[i][b].getMin();

                    if (AABBintersect(Amax, Amin, Bmax, Bmin))
                        console.log("Asteroid-Asteroid Collision");
                }
            }
        }
    }

    #checkAstShipCollision(){
        const shipMax = this.StarDestroyer.getGlobalMax();
        const shipMin = this.StarDestroyer.getGlobalMin();

        /*
        For now, The star destroyer will always be in the center of the cell grid
        This means that by default, only asteroids middle cells of the cube should be examined for
        collision
        if this.numAxiscells is even, choose this.numAxiscells/2 - 1 and this.numAxiscells/2 for all axes
        Indexing starts at 0
        */
        if (this.numAxisCells % 2 != 0) {
            console.log("Cell Grid number of cells not even"); return;
        }

        const minCell = this.numAxisCells / 2 - 1;
        const maxCell = minCell + 1;
        for (let i = minCell; i <= maxCell; ++i){
            for (let j = minCell; j <= maxCell; ++j){
                for (let k = minCell; k <= maxCell; ++k){
                    const cellIndex = i*this.numAxisCells*this.numAxisCells + j*this.numAxisCells + k;
                    const nearbyAsteroids = this.cellGrid[cellIndex];//array of asteroids in the index cell
                    for (let a = 0; a < nearbyAsteroids.length; ++a){
                        const ast = nearbyAsteroids[a];
                        //only if asteroid and stardest AABB instersect proceed with ship vertex check
                        if (AABBintersect(shipMax, shipMin, ast.getMax(), ast.getMin())){
                            const collisPoint = this.#shipVertexAABBIntersect(ast.getMax(), ast.getMin());
                            //if (this.#shipVertexAABBIntersect(ast.getMax(), ast.getMin())){
                            if (collisPoint != undefined){
                                const distance = glMatrix.vec3.distance(this.camera.getPosition(), ast.getWorldPos());
                                this.SoundManager.playAstExplosion(distance);
                                console.log("Asteroid-Ship Collision");
                                this.ExplosionManager.createExplosion(ast.getWorldPos(), ast.getScale());//asteroid explosion (temp)
                                this.ExplosionManager.createExplosion(collisPoint, ast.getScale()/2, true);//ship explosion (permanent)
                                this.#teleportAstToEdge(ast);
                                this.#numShipExplosions++;
                            }
                        }
                    }
                }
            }
        }
        
    }

    #getPlayerAABB(){
        //The player will be represented as an AABB cube centered around the camera position with 1 halfway length
        const playerPos = this.camera.getPosition();
        const playerHalfLength = 0.2;
        const playerMax = glMatrix.vec3.fromValues(playerPos[0] + playerHalfLength,
            playerPos[1] + playerHalfLength, playerPos[2] + playerHalfLength);
        const playerMin = glMatrix.vec3.fromValues(playerPos[0] - playerHalfLength,
            playerPos[1] - playerHalfLength, playerPos[2] - playerHalfLength);

        return {
            max: playerMax,
            min: playerMin,
        };

    }

    #checkShipPlayerCollision(){
        const playerAABB = this.#getPlayerAABB();
        const playerMax = playerAABB.max;
        const playerMin = playerAABB.min;

        const shipMax = this.StarDestroyer.getGlobalMax();
        const shipMin = this.StarDestroyer.getGlobalMin();
        
        //only if player is in the ship bounding box do more detailed check of the model vertices
        if (AABBintersect(playerMax, playerMin, shipMax, shipMin)){
            console.log("Player Inside Ship AABB");
            /* OLD CODE TRANSFERRED TO shipVertexAABBIntersect()
            const modelMatrix = this.StarDestroyer.getModelMatrix();
            const meshMatrices = this.StarDestroyer.getMeshMatrices();

            const pointArrays = this.StarDestroyer.getPointArrays();

            const fullMeshTransform = glMatrix.mat4.create();
            for(let i = 0; i < pointArrays.length; ++i){
                const meshIndex = pointArrays[i].index;
                const meshMatrix = meshMatrices[meshIndex];
                glMatrix.mat4.multiply(fullMeshTransform, modelMatrix, meshMatrix);
                for (let j = 0; j < pointArrays[i].points.length; j+=3){
                    //POINT MUST BE DEEP COPY; NOT REFERENCE SINCE IT TRANSFORMED 
                    const point = glMatrix.vec3.clone(pointArrays[i].points[j]);
                    glMatrix.vec3.transformMat4(point, point, fullMeshTransform);
                    if (isPointInsideAABB(point, playerMax, playerMin)){
                        console.log("Player-Ship Collision");
                        return;
                    }
                }
            }
            */
            const collisPoint = this.#shipVertexAABBIntersect(playerMax, playerMin);
            //if (this.#shipVertexAABBIntersect(playerMax, playerMin)){
            if (collisPoint != undefined){
                console.log("Player-Ship Collision");
                const distance = 0;//player is right next to the ship
                this.SoundManager.playAstExplosion(distance);

                const playerPos = this.camera.getPosition();
                this.ExplosionManager.createExplosion(playerPos, 0.3, true);//permanent explosion
                this.#playerActive = false;
                this.#gameOver = true;
            }
        }
    }

    //Returns the Point of Intersection, if any, undefined if no intersection
    #shipVertexAABBIntersect(boxMax, boxMin){
        const modelMatrix = this.StarDestroyer.getModelMatrix();
        const meshMatrices = this.StarDestroyer.getMeshMatrices();

        const pointArrays = this.StarDestroyer.getPointArrays();

        const fullMeshTransform = glMatrix.mat4.create();
        for(let i = 0; i < pointArrays.length; ++i){
            const meshIndex = pointArrays[i].index;
            const meshMatrix = meshMatrices[meshIndex];
            glMatrix.mat4.multiply(fullMeshTransform, modelMatrix, meshMatrix);
            for (let j = 0; j < pointArrays[i].points.length; j+=3){
                //POINT MUST BE DEEP COPY; NOT REFERENCE SINCE IT TRANSFORMED 
                const point = glMatrix.vec3.clone(pointArrays[i].points[j]);
                glMatrix.vec3.transformMat4(point, point, fullMeshTransform);
                if (isPointInsideAABB(point, boxMax, boxMin)){
                    //return true;
                    return point;
                }
            }
        }
        //return false;
        return undefined;
    }

    #checkPlayerAstCollision(){
        const playerPos = this.camera.getPosition();
        const cellIndex = this.#getCellIndexFromPosition(playerPos);
        if (cellIndex == -1){
            console.log("Player Outside Cell Grid");
            return;
        }

        const playerAABB = this.#getPlayerAABB();
        const nearbyAsteroids = this.cellGrid[cellIndex];//array of asteroids in the same cell as player
        for (let i = 0; i < nearbyAsteroids.length; ++i){
            const ast = nearbyAsteroids[i];

            if (AABBintersect(playerAABB.max, playerAABB.min, ast.getMax(), ast.getMin())){
                console.log("Player-Asteroid Collision");
                const distance = 0;//player is right next to the asteroid
                this.SoundManager.playAstExplosion(distance);
                this.#playerActive = false;
                this.#gameOver = true;
                this.#teleportAstToEdge(ast);
                this.ExplosionManager.createExplosion(playerPos, 0.3, true);//permanent explosion
                return;
            }
        }
    }

    #checkAstLaserCollisions(){
        const laserArr = this.BulletManager.getBulletsArr();
        for (let i = 0; i < laserArr.length; ++i){
            const laser = laserArr[i];//reference to laser object; can change activity status
            if (laser.isActive()){

                const laserPos = laser.getWorldPos();
                const gridCellIndex = this.#getCellIndexFromPosition(laserPos);
                if (gridCellIndex != -1){
                    const nearbyAsteroids = this.cellGrid[gridCellIndex];
                    for (let j = 0; j < nearbyAsteroids.length; j++){
                        const ast = nearbyAsteroids[j];
                        /*
                        if (isPointInsideAABB(laserPos, ast.getMax(), ast.getMin())){
                            const astPos = ast.getWorldPos();//explosion center should be at asteroid's center, not laser's
                            laser.setInactive();
                            this.ExplosionManager.createExplosion(astPos, ast.getScale());
                        }
                        */
                        const lineSegment = laser.getBulletLineSegment();
                        if (testSegmentAABB(lineSegment[0], lineSegment[1], ast.getMax(), ast.getMin())){
                            const astPos = ast.getWorldPos();//explosion center should be at asteroid's center, not laser's
                            const distance = glMatrix.vec3.distance(astPos, this.camera.getPosition());
                            this.SoundManager.playAstExplosion(distance);
                            laser.setInactive();
                            this.ExplosionManager.createExplosion(astPos, ast.getScale());
                            this.#teleportAstToEdge(ast);
                            this.#numAstDestroyed++;
                        }
                    }
                }
            }
        }
    }

    #updateCellGrid(newGame=false){
        this.#blankCellGrid();//reset the cell grid every iteration

        let blacklistCells;
        if (newGame){//create blacklisted cell indices once outside of for loops if newGame
            blacklistCells = [];
            const minCell = this.numAxisCells / 2 - 1;
            const maxCell = minCell + 1;
            for (let i = minCell; i <= maxCell; ++i){
                for (let j = minCell; j <= maxCell; ++j){
                    for (let k = minCell; k <= maxCell; ++k){
                        const cellNum = i*this.numAxisCells*this.numAxisCells + j*this.numAxisCells + k;
                        blacklistCells.push(cellNum);
                    }
                }
            }
        }

        for (let i = 0; i < this.AstManager.distinctMeshCount; ++i){
            for(let j = 0; j < this.AstManager.astList[i].length; ++j){
                const worldPos = this.AstManager.astList[i][j].getWorldPos();

                const index = this.#getCellIndexFromPosition(worldPos);

                if (newGame){//No asteroids should be in the center cells of the map at the start of new session
                    if (blacklistCells.includes(index)){//need to remove asteroid from center
                        this.#teleportAstToEdge(this.AstManager.astList[i][j]);
                        const newPos = this.AstManager.astList[i][j].getWorldPos();
                        const newIndex = this.#getCellIndexFromPosition(newPos);
                        this.cellGrid[newIndex].push(this.AstManager.astList[i][j]);
                        continue;
                    }
                }
                if (index != -1){
                    this.cellGrid[index].push(this.AstManager.astList[i][j]);
                }
                else{//reset the asteroid position and heading
                    this.#teleportAstToEdge(this.AstManager.astList[i][j]);
                    const newPos = this.AstManager.astList[i][j].getWorldPos();
                    const newIndex = this.#getCellIndexFromPosition(newPos);
                    this.cellGrid[newIndex].push(this.AstManager.astList[i][j]);
                }
            }
        }
    }

    //based on world position identify the xCell, yCell, zCell location and its index in the 1d cellgrid array
    //-1 if position is outside the cell grid
    #getCellIndexFromPosition(worldPos){
        let xCell; let yCell; let zCell;
        //Disregard asteroids outside the grid bounds
        const xPos = worldPos[0];
        if (xPos >= this.minX && xPos < this.maxX)
            xCell = Math.floor((xPos-this.minX)/this.cellWidth);
        else return -1;

        const yPos = worldPos[1];
        if (yPos >= this.minY && yPos < this.maxY)
            yCell = Math.floor((yPos - this.minY)/this.cellWidth);
        else return -1;

        const zPos = worldPos[2];
        if(zPos >= this.minZ && zPos < this.maxZ)
            zCell = Math.floor((zPos - this.minZ)/this.cellWidth);
        else return -1;

        const index = xCell*this.numAxisCells*this.numAxisCells + yCell*this.numAxisCells + zCell;
        return index;
    }

}

function AABBintersect(Amax, Amin, Bmax, Bmin){//axis aligned bounding box intersect (3D)
    return(
        Amin[0] <= Bmax[0] &&
        Amax[0] >= Bmin[0] &&
        Amin[1] <= Bmax[1] &&
        Amax[1] >= Bmin[1] &&
        Amin[2] <= Bmax[2] &&
        Amax[2] >= Bmin[2]
    );
}

function isPointInsideAABB(point, boxMax, boxMin) {
    return (
      point[0] >= boxMin[0] &&
      point[0] <= boxMax[0] &&
      point[1] >= boxMin[1] &&
      point[1] <= boxMax[1] &&
      point[2] >= boxMin[2] &&
      point[2] <= boxMax[2]
    );
}


//Function from "Real Time Collision" 5.3 pg 183
function testSegmentAABB(p0, p1, boxMax, boxMin){
    //box center point
    const c = glMatrix.vec3.fromValues(0.5 * (boxMax[0] + boxMin[0]), 0.5 * (boxMax[1] + boxMin[1]), 0.5 * (boxMax[2] + boxMin[2]));
    //box halflength extents
    const e = glMatrix.vec3.create();
    glMatrix.vec3.subtract(e, boxMax, c);
    //segment midpoint
    const m = glMatrix.vec3.fromValues(0.5 * (p0[0] + p1[0]), 0.5 * (p0[1] + p1[1]), 0.5 * (p0[2] + p1[2]));
    //segment halflength vector
    const d = glMatrix.vec3.create();
    glMatrix.vec3.subtract(d, p1, m);
    //translate box and segment to origin
    glMatrix.vec3.subtract(m, m, c);

    //try world coordinates as separating axes
    let adx = Math.abs(d[0]);
    if(Math.abs(m[0]) > e[0] + adx) return false;
    let ady = Math.abs(d[1]);
    if(Math.abs(m[1]) > e[1] + ady) return false;
    let adz = Math.abs(d[2]);
    if(Math.abs(m[2]) > e[2] + adz) return false;

    // Add in an epsilon term to counteract arithmetic errors when segment is
    // (near) parallel to a coordinate axis (see text for detail)
    const epsilon = 0.000001;
    adx+= epsilon; ady+=epsilon; adz+=epsilon;
    //Try cross products of segment direction vector with coordinate axes
    if (Math.abs(m[1]*d[2] - m[2]*d[1]) > e[1] * adz + e[2] * ady) return false;
    if (Math.abs(m[2]*d[0] - m[0]*d[2]) > e[0] * adz + e[2] * adx) return false;
    if (Math.abs(m[0]*d[1] - m[1]*d[0]) > e[0] * ady + e[1] * adx) return false;
    //No separating axis found; segment must be overlapping AABB
    return true;
}
  
export{WorldManager};

