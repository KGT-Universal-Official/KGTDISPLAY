let peer = null;
let currentCode = null;
let hostStream = null;
let isPeerReady = false;
let dataChannel = null;

const peerConfig = {
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

// Setup Host PC (Ensures server registration before showing code)
async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 60 } },
            audio: false
        });

        currentCode = generateCode();
        
        // Initialize Peer
        peer = new Peer("KGT-" + currentCode, peerConfig);

        peer.on('open', (id) => {
            // Show code ONLY when successfully registered on the server
            document.getElementById('generated-pin').innerText = currentCode;
            document.getElementById('connection-status').innerText = "Status: 🟢 Server Ready! Waiting for connection...";
        });

        peer.on('connection', (conn) => {
            dataChannel = conn;
            document.getElementById('connection-status').innerText = "Status: 🔵 Control Channel Active!";
            
            dataChannel.on('data', (data) => {
                console.log("Control signal received from phone:", data);
                // Handle touch/click coordinates here for PC control simulation
            });
        });

        peer.on('call', (call) => {
            document.getElementById('connection-status').innerText = "Status: 🟢 Connected & Streaming!";
            call.answer(hostStream);
        });

        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                // If code collides, regenerate a new one automatically
                location.reload();
            } else {
                console.error("Peer error:", err);
            }
        });

        hostStream.getVideoTracks()[0].onended = function() {
            alert("Screen sharing ended.");
            location.reload();
        };

    } catch (err) {
        alert("Screen share permission is required!");
        location.reload();
    }
}

function setupClientReceiver() {
    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        isPeerReady = true;
    });

    peer.on('error', (err) => {
        console.error("Receiver error:", err);
    });
}

// Connect Function with Auto Fullscreen & Controls
function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (!isPeerReady) {
        showError("⏳ Initializing network... Please wait 2 seconds.");
        return;
    }

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');
    const hostId = "KGT-" + inputCode;

    // Connect Data Channel for Controls
    const conn = peer.connect(hostId);
    conn.on('open', () => {
        dataChannel = conn;
        console.log("Control DataChannel established!");
    });

    const dummyStream = new MediaStream();
    const call = peer.call(hostId, dummyStream);

    if (!call) {
        showError("❌ Connection failed.");
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

        // 📱 AUTOMATIC FULLSCREEN ON PHONE/DEVICE
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log("Fullscreen blocked:", err));
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }

        // Send touch/click coordinates from phone to PC via DataChannel
        videoElem.addEventListener('click', (e) => {
            const rect = videoElem.getBoundingClientRect();
            const x = (e.clientX - rect.left) / videoElem.clientWidth;
            const y = (e.clientY - rect.top) / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'click', x: x, y: y });
            }
        });
    });

    setTimeout(() => {
        if (!connected) {
            showError("❌ Invalid Code or Host Offline!");
        }
    }, 6000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}