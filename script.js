document.addEventListener('DOMContentLoaded', () => {
    // Get references to the canvas elements
    const worldCanvas = document.getElementById('world');
    const handCanvas = document.getElementById('handCanvas');
    const ctx = handCanvas.getContext('2d');

    // Add canvas styles
    handCanvas.style.position = 'absolute';
    handCanvas.style.top = '0';
    handCanvas.style.left = '0';
    handCanvas.style.zIndex = '2';

    // Set canvas dimensions
    worldCanvas.width = window.innerWidth;
    worldCanvas.height = window.innerHeight;
    handCanvas.width = window.innerWidth;
    handCanvas.height = window.innerHeight;

    // Initialize the grid
    const grid = [];
    const gridSize = 15;
    const maxRadius = 2.5;

    for (let x = 0; x < handCanvas.width; x += gridSize) {
        for (let y = 0; y < handCanvas.height; y += gridSize) {
            grid.push({ 
                x, 
                y, 
                radius: maxRadius, 
                opacity: 0,
                decay: 0.1 // Add decay rate for trail effect
            });
        }
    }

    // Create and configure video element
    const video = document.createElement('video');
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '300px';
    video.style.opacity = '0.5';
    document.body.appendChild(video);

    // Store past hand positions for smoothing
    const previousHandPositions = [];

    // Event Listeners
    video.addEventListener('loadedmetadata', () => {
        console.log('Video dimensions:', video.videoWidth, video.videoHeight);
        runDetection();
    });

    // Initialize audio context on first user interaction
    document.addEventListener('click', async () => {
        if (!audioContext) {
            await setupAudio();
        }
        if (audioContext.state !== 'running') {
            audioContext.resume();
        }
    }, { once: true });

    window.addEventListener('resize', () => {
        worldCanvas.width = window.innerWidth;
        worldCanvas.height = window.innerHeight;
        handCanvas.width = window.innerWidth;
        handCanvas.height = window.innerHeight;
    });

    // Audio setup
    let audioContext;
    let noteSounds = {};
    let currentMelody = [];
    let currentNoteIndex = 0;
    const recentNotes = [];
    const MAX_RECENT_NOTES = 30;

    // Your existing noteUrls and melodies objects
    const noteUrls = {
        'High A': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20A.mp3',
        'High B': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20B.mp3',
        'High C': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20C.mp3',
        'High D': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20D.mp3',
        'High E': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20E.mp3',
        'High F': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20F.mp3',
        'High G': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/High%20G.mp3',
        'Low A': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20A.mp3',
        'Low B': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20B.mp3',
        'Low C': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20C.mp3',
        'Low D': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20D.mp3',
        'Low E': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20E.mp3',
        'Low F': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20F.mp3',
        'Low G': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20G.mp3',
        'CG': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20C%20High%20G.mp3',
        'GC': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20G%20High%20C.mp3',
        'CE': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20C%20High%20E.mp3',
        'EA': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20E%20High%20A.mp3',
        'FA': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20F%20High%20A.mp3',
        'GB': 'https://rimusta-yoshi.github.io/a-dictionary-of-kalimba/Low%20G%20High%20B.mp3'
      };
  

    const melodies = [
        ['Low C', 'GC', 'High D', 'Low C', 'GC', 'High E', 'Low C', 'High A', 'CG', 'Low G', 'High D', 'CE'],
        ['Low G', 'CG', 'High E', 'GC', 'Low C', 'CE', 'High A', 'Low G', 'High C'],
        ['Low C', 'CE', 'High G', 'High C', 'CE', 'High G', 'High C', 'EA'],
        ['High G', 'High E', 'GC', 'High D', 'CE', 'High C', 'GB', 'High E'],
        ['GC', 'High C', 'High D', 'CE', 'High G', 'High C', 'EA', 'High F']
      ];

    // Initialize audio
    async function setupAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        try {
            for (const [note, url] of Object.entries(noteUrls)) {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                noteSounds[note] = await audioContext.decodeAudioData(arrayBuffer);
            }
        } catch (error) {
            console.error("Error setting up audio:", error);
        }
    }

    // Matter.js setup
    const { Engine, Render, Runner, Bodies, Composite } = Matter;
    const engine = Engine.create();
    const world = engine.world;
    world.gravity.y = 0.3;

    const render = Render.create({
        element: document.body,
        engine: engine,
        canvas: worldCanvas,
        options: {
            width: window.innerWidth,
            height: window.innerHeight,
            wireframes: false
        }
    });

    function pulseShape(shape) {
        const pulseScale = 1.2; // Increase size by 20%
        const pulseDuration = 100; // Duration of the pulse in milliseconds
    
        Matter.Body.scale(shape, pulseScale, pulseScale);
    
        setTimeout(() => {
            Matter.Body.scale(shape, 1/pulseScale, 1/pulseScale);
        }, pulseDuration);
    }

    // Collision detection for sound
    Matter.Events.on(engine, 'collisionStart', function(event) {
        event.pairs.forEach(function(pair) {
            if (!pair.bodyA.isStatic && !pair.bodyB.isStatic) {
                const velocity = Math.hypot(
                    pair.bodyA.velocity.x - pair.bodyB.velocity.x,
                    pair.bodyA.velocity.y - pair.bodyB.velocity.y
                );
                
                if (velocity > 3) {
                    // Play sound
                    playNextNote();

                    // Add pulse effect
                    pulseShape(pair.bodyA);
                    pulseShape(pair.bodyB);
                }
            }
        });
    });

    function playNote(note) {
        if (audioContext && audioContext.state === 'running' && noteSounds[note]) {
            if (!recentNotes.includes(note)) {
                const source = audioContext.createBufferSource();
                source.buffer = noteSounds[note];
                source.connect(audioContext.destination);
                source.start();
                
                recentNotes.push(note);
                if (recentNotes.length > MAX_RECENT_NOTES) {
                    recentNotes.shift();
                }
            }
        }
    }
    
    function playNextNote() {
        if (currentMelody.length === 0) {
            currentMelody = melodies[Math.floor(Math.random() * melodies.length)];
            currentNoteIndex = 0;
        }
    
        const note = currentMelody[currentNoteIndex];
        playNote(note);
        currentNoteIndex = (currentNoteIndex + 1) % currentMelody.length;
    
        if (currentNoteIndex === 0) {
            currentMelody = [];
        }
    }

    Render.run(render);
    Runner.run(Runner.create(), engine);

    // Shape management
    const maxShapes = 20;
    const shapes = [];

    function createShape() {
        const shapeType = Math.floor(Math.random() * 5);
        let shape;
        const size = Math.random() * 80 + 20;
        const spawnX = Math.random() * window.innerWidth;
        const spawnY = -100;
    
        switch (shapeType) {
            case 0:
                shape = Bodies.circle(spawnX, spawnY, size / 2, { restitution: 0.8 });
                break;
            case 1:
                shape = Bodies.rectangle(spawnX, spawnY, size, size, { restitution: 0.8 });
                break;
            case 2:
                shape = Bodies.polygon(spawnX, spawnY, 3, size, { restitution: 0.8 });
                break;
            case 3:
                shape = Bodies.polygon(spawnX, spawnY, 5, size, { restitution: 0.8 });
                break;
            case 4:
                shape = Bodies.polygon(spawnX, spawnY, 6, size, { restitution: 0.8 });
                break;
        }
        
        Composite.add(world, shape);
        shapes.push(shape);
    }
    
    function manageShapes() {
        // Remove off-screen shapes
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (shapes[i].position.y > window.innerHeight + 100) {
                Composite.remove(world, shapes[i]);
                shapes.splice(i, 1);
            }
        }
    
        // Add new shapes if below max
        while (shapes.length < maxShapes) {
            createShape();
        }
    }
    
    setInterval(manageShapes, 100); // Manage shapes every 100 milliseconds


    // Grid functions
    function updateCircles(handX, handY) {
        const decayRate = 0.02; // Adjust this value to control trail length (smaller = longer trail)
        const interactionRadius = 100; // Increase interaction radius for a longer trail
        
        grid.forEach(circle => {
            const distance = Math.hypot(circle.x - handX, circle.y - handY);
            
            if (distance < interactionRadius) {
                // Smoothly transition opacity based on distance
                const targetOpacity = 1 - (distance / interactionRadius);
                // Gradually approach target opacity for smoother transitions
                circle.opacity = circle.opacity + (targetOpacity - circle.opacity) * 0.3;
                
                // Scale the circle size based on proximity
                const growthFactor = 2; // Maximum size multiplier
                const targetRadius = circle.radius * (1 + (growthFactor - 1) * (1 - distance / interactionRadius));
                circle.currentRadius = circle.currentRadius || circle.radius;
                circle.currentRadius = circle.currentRadius + (targetRadius - circle.currentRadius) * 0.3;
            } else {
                // Gradually fade out circles that are too far
                circle.opacity = Math.max(0, circle.opacity - decayRate);
                // Gradually return to original size
                if (circle.currentRadius) {
                    circle.currentRadius = circle.currentRadius + (circle.radius - circle.currentRadius) * 0.3;
                }
            }
        });
    }
    
    function drawGrid() {
        ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        grid.forEach(circle => {
            if (circle.opacity > 0) {
                ctx.beginPath();
                ctx.arc(circle.x, circle.y, circle.currentRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${circle.opacity})`;
                ctx.fill();
            }
        });
    }

    // Hand tracking setup
    const modelParams = {
        flipHorizontal: true,
        imageScaleFactor: 1,
        maxNumBoxes: 1,
        iouThreshold: 0.7,
        scoreThreshold: 0.35
    };

    let model;

    handTrack.load(modelParams).then(lmodel => {
        model = lmodel;
        startVideo();
    });

    function startVideo() {
        handTrack.startVideo(video).then(status => {
            if (status) {
                runDetection(); // Begin detecting hands if video is enabled
            } else {
                console.log("Please enable video"); // Prompt user if video is not enabled
            }
        });
    }

    function smoothPositions(previousPositions, currentPosition, windowSize = 5) {
        previousPositions.push(currentPosition);

        // Keep only the last `windowSize` positions
        if (previousPositions.length > windowSize) {
            previousPositions.shift(); // Remove the oldest position
        }
    
        // Calculate the average position
        const smoothedX = previousPositions.reduce((sum, pos) => sum + pos[0], 0) / previousPositions.length;
        const smoothedY = previousPositions.reduce((sum, pos) => sum + pos[1], 0) / previousPositions.length;
    
        return [smoothedX, smoothedY];
    }

    function runDetection() {
        model.detect(video).then(predictions => {
            if (predictions.length === 0) {
                grid.forEach(circle => {
                    circle.opacity = Math.max(0, circle.opacity - circle.decay);
                });
                drawGrid();
            } else {
                predictions.forEach(prediction => {
                    // Add size check to filter out face detections
                    const boxSize = prediction.bbox[2] * prediction.bbox[3];
                    const isHandSized = boxSize < (video.videoWidth * video.videoHeight) / 4;
    
                    if ((prediction.label === 'open' || prediction.label === 'closed') && isHandSized) {
                        const handCenterX = prediction.bbox[0] + prediction.bbox[2] / 2;
                        const handCenterY = prediction.bbox[1] + prediction.bbox[3] / 2;
    
                        const [smoothedX, smoothedY] = smoothPositions(previousHandPositions, [handCenterX, handCenterY]);
    
                        const scaledX = smoothedX * (handCanvas.width / video.videoWidth);
                        const scaledY = smoothedY * (handCanvas.height / video.videoHeight);
    
                        updateCircles(scaledX, scaledY);
                        drawGrid();
                        
                        // Apply different forces based on hand state
                        const isClosedHand = prediction.label === 'closed';
                        applyHandForce(scaledX, scaledY, isClosedHand);
                    }
                });
            }
            requestAnimationFrame(runDetection);
        }).catch(error => console.error("Detection error:", error));
    }

    function applyHandForce(handX, handY, isClosedHand) {
        const allBodies = Composite.allBodies(world);
        allBodies.forEach(body => {
            const distance = Math.hypot(body.position.x - handX, body.position.y - handY);
            if (isClosedHand) {
                // Larger radius and stronger pull for closed hand (black hole effect)
                if (distance < 200) { // Larger radius for attraction
                    const forceMagnitude = 0.004; // Stronger force for attraction
                    const forceX = (handX - body.position.x) * forceMagnitude; // Reverse direction for attraction
                    const forceY = (handY - body.position.y) * forceMagnitude;
                    Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
                }
            } else {
                // Original repulsion for open hand
                if (distance < 100) {
                    const forceMagnitude = 0.002;
                    const forceX = (body.position.x - handX) * forceMagnitude;
                    const forceY = (body.position.y - handY) * forceMagnitude;
                    Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
                }
            }
        });
    }

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
    });

    function applyCursorForce() {
        const allBodies = Composite.allBodies(world);
        allBodies.forEach(body => {
            const distance = Math.hypot(body.position.x - mouseX, body.position.y - mouseY);
            if (distance < 100) { 
                const forceMagnitude = 0.001; 
                const forceX = (body.position.x - mouseX) * forceMagnitude;
                const forceY = (body.position.y - mouseY) * forceMagnitude;
                Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY }); 
            }
        });
    }

    // Intervals
    setInterval(manageShapes, 100);
    setInterval(applyCursorForce, 16);
}); // End of DOMContentLoaded