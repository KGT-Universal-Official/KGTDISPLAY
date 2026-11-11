let peer = null;
let currentCode = null;
let hostStream = null;
let isPeerReady = false;
let dataChannel = null;
let overlayTimeout = null;

const peerConfig = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

function selectRole(selectedRole) {
    document.getElementById('role-selection').classList.add('hidden');

    if (selectedRole === 'sender') {
        document.getElementById('sender-box').classList.remove('hidden');
        setupHostPC();
    } else {
        document.getElementById('receiver-box').classList.remove('hidden');
        setupClientReceiver();
    }
}

function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: "always", 
                frameRate: { ideal: 60, max: 60 },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        currentCode = generateCode();
        const fullHostId = "KGT-PROD-" + currentCode;
        
        peer = new Peer(fullHostId, peerConfig);

        peer.on('open', (id) => {
            document.getElementById('generated-pin').innerText = currentCode;
            document.getElementById('connection-status').innerText = "Status: 🟢 Secure Server Online & Waiting...";
        });

        peer.on('connection', (conn) => {
            dataChannel = conn;
            document.getElementById('connection-status').innerText = "Status: 🔵 Phone Connected & Touch Active!";
            
            dataChannel.on('data', (data) => {
                console.log("Touch received on PC:", data);
                if (data && data.type === 'click') {
                    // Map incoming percentage coordinates to actual PC screen resolution
                    const screenX = Math.round(data.x * window.screen.width);
                    const screenY = Math.round(data.y * window.screen.height);
                    console.log(`Simulated Click executed at Screen Coordinates -> X: ${screenX}, Y: ${screenY}`);
                    
                    // Visual indicator on PC to show where phone touched
                    showTouchPointer(screenX, screenY);
                }
            });
        });

        peer.on('call', (call) => {
            document.getElementById('connection-status').innerText = "Status: 🟢 Streaming Active to Phone!";
            call.answer(hostStream);
        });

        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') location.reload();
        });

        hostStream.getVideoTracks()[0].onended = function() {
            location.reload();
        };

    } catch (err) {
        alert("Screen share permission is required!");
        location.reload();
    }
}

// Temporary visual dot on PC to verify touch input received from phone
function showTouchPointer(x, y) {
    const dot = document.createElement('div');
    dot.style.position = 'fixed';
    dot.style.left = (x - 10) + 'px';
    dot.style.top = (y - 10) + 'px';
    dot.style.width = '20px';
    dot.style.height = '20px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#00ffcc';
    dot.style.border = '2px solid #fff';
    dot.style.zIndex = '999999';
    dot.style.pointerEvents = 'none';
    dot.style.boxShadow = '0 0 10px #00ffcc';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 400);
}

function setupClientReceiver() {
    peer = new Peer(peerConfig);
    peer.on('open', (id) => { isPeerReady = true; });
}

function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (!isPeerReady) {
        showError("⏳ Initializing network... Please wait 3 seconds.");
        return;
    }

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');
    const hostId = "KGT-PROD-" + inputCode;

    const conn = peer.connect(hostId);
    conn.on('open', () => { dataChannel = conn; });

    const canvas = document.createElement('canvas');
    const dummyStream = canvas.captureStream(10);
    const call = peer.call(hostId, dummyStream);

    if (!call) {
        showError("❌ Failed to initiate call.");
        return;
    }

    let connected = false;

    call.on('stream', (remoteStream) => {
        connected = true;
        document.getElementById('receiver-box').classList.add('hidden');
        document.getElementById('stream-container').classList.remove('hidden');

        const videoElem = document.getElementById('remote-video');
        videoElem.srcObject = remoteStream;
        videoElem.play().catch(e => console.log("Play error:", e));

        // Auto Fullscreen on Phone
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log(err));
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }

        const overlayBar = document.getElementById('overlay-bar');

        // Touch & Click Mapping
        videoElem.addEventListener('click', (e) => {
            const rect = videoElem.getBoundingClientRect();
            
            // Check if user clicked the TOP-RIGHT corner (to toggle disconnect menu safely)
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            if (clickX > rect.width - 80 && clickY < 60) {
                // Toggle menu only when top-right corner is tapped
                if (overlayBar.classList.contains('visible')) {
                    overlayBar.classList.remove('visible');
                } else {
                    overlayBar.classList.add('visible');
                    clearTimeout(overlayTimeout);
                    overlayTimeout = setTimeout(() => {
                        overlayBar.classList.remove('visible');
                    }, 4000);
                }
                return;
            }

            // Otherwise, send normal touch coordinates to PC for control
            const x = clickX / videoElem.clientWidth;
            const y = clickY / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'click', x: x, y: y });
            }
        });
    });

    setTimeout(() => {
        if (!connected) showError("❌ Host Offline or Invalid Code!");
    }, 15000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.add('hidden');
}

function disconnectStream() {
    location.reload();
}