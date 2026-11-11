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
            document.getElementById('connection-status').innerText = "Status: 🔵 Phone Connected & Control Active!";
            
            dataChannel.on('data', (data) => {
                console.log("Control signal received:", data);
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

        // 📱 Auto-Hide Disconnect Bar & Toggle on Tap
        const overlayBar = document.getElementById('overlay-bar');
        
        function showOverlayTemporarily() {
            overlayBar.classList.add('visible');
            clearTimeout(overlayTimeout);
            overlayTimeout = setTimeout(() => {
                overlayBar.classList.remove('visible');
            }, 3000); // Hides after 3 seconds
        }

        showOverlayTemporarily();

        // Tap anywhere on video to show menu or send touch coordinates
        videoElem.addEventListener('click', (e) => {
            showOverlayTemporarily();

            const rect = videoElem.getBoundingClientRect();
            const x = (e.clientX - rect.left) / videoElem.clientWidth;
            const y = (e.clientY - rect.top) / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'click', x: x, y: y });
            }
        });

        videoElem.addEventListener('touchstart', (e) => {
            showOverlayTemporarily();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const rect = videoElem.getBoundingClientRect();
                const x = (touch.clientX - rect.left) / videoElem.clientWidth;
                const y = (touch.clientY - rect.top) / videoElem.clientHeight;

                if (dataChannel && dataChannel.open) {
                    dataChannel.send({ type: 'touchstart', x: x, y: y });
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