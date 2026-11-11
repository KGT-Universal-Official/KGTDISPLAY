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
            document.getElementById('connection-status').innerText = "Status: 🟢 Virtual Display Ready...";
        });

        peer.on('connection', (conn) => {
            dataChannel = conn;
            document.getElementById('connection-status').innerText = "Status: 🔵 Touch & Display Connected!";
            
            dataChannel.on('data', (data) => {
                if (data && data.type === 'touch') {
                    // Calculate exact coordinate relative to host primary screen dimensions
                    const targetX = Math.round(data.x * window.innerWidth);
                    const targetY = Math.round(data.y * window.innerHeight);
                    console.log(`Remote Touch Received -> X: ${targetX}, Y: ${targetY}`);
                    
                    // Visual feedback ripple on host screen
                    showTouchRipple(targetX, targetY);
                }
            });
        });

        peer.on('call', (call) => {
            document.getElementById('connection-status').innerText = "Status: 🟢 Streaming Live to Phone!";
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

// Visual touch indicator on host screen
function showTouchRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.style.position = 'fixed';
    ripple.style.left = (x - 15) + 'px';
    ripple.style.top = (y - 15) + 'px';
    ripple.style.width = '30px';
    ripple.style.height = '30px';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(0, 255, 204, 0.6)';
    ripple.style.border = '2px solid #fff';
    ripple.style.zIndex = '999999';
    ripple.style.pointerEvents = 'none';
    ripple.style.transition = 'all 0.3s ease-out';
    ripple.style.transform = 'scale(1.2)';
    document.body.appendChild(ripple);
    setTimeout(() => {
        ripple.style.transform = 'scale(0.2)';
        ripple.style.opacity = '0';
        setTimeout(() => ripple.remove(), 300);
    }, 100);
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

        // Spacedesk Style Touch Interaction & Floating Menu Toggle
        function toggleMenu() {
            if (overlayBar.classList.contains('visible')) {
                overlayBar.classList.remove('visible');
            } else {
                overlayBar.classList.add('visible');
                clearTimeout(overlayTimeout);
                overlayTimeout = setTimeout(() => {
                    overlayBar.classList.remove('visible');
                }, 4000);
            }
        }

        videoElem.addEventListener('click', (e) => {
            const rect = videoElem.getBoundingClientRect();
            
            // If tapped near bottom center or corners, toggle menu
            if (e.clientY > rect.height - 80) {
                toggleMenu();
                return;
            }

            // Map touch percentage accurately across video viewport
            const x = (e.clientX - rect.left) / videoElem.clientWidth;
            const y = (e.clientY - rect.top) / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'touch', x: x, y: y });
            }
        });

        // Double tap anywhere on screen to toggle control menu
        let lastTap = 0;
        videoElem.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                toggleMenu();
                e.preventDefault();
            }
            lastTap = currentTime;

            if (e.changedTouches.length > 0 && tapLength >= 300) {
                const touch = e.changedTouches[0];
                const rect = videoElem.getBoundingClientRect();
                
                const x = (touch.clientX - rect.left) / videoElem.clientWidth;
                const y = (touch.clientY - rect.top) / videoElem.clientHeight;

                if (dataChannel && dataChannel.open) {
                    dataChannel.send({ type: 'touch', x: x, y: y });
                }
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
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}