let peer = null;
let currentCode = null;
let hostStream = null;
let isPeerReady = false;
let dataChannel = null;

// Secure PeerJS Configuration for HTTPS (GitHub Pages compatibility)
const peerConfig = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
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

// Setup Host PC
async function setupHostPC() {
    try {
        hostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 60 } },
            audio: false
        });

        currentCode = generateCode();
        const fullHostId = "KGT-PROD-" + currentCode;
        
        console.log("Initializing host with ID:", fullHostId);
        peer = new Peer(fullHostId, peerConfig);

        peer.on('open', (id) => {
            console.log("Host registered successfully:", id);
            document.getElementById('generated-pin').innerText = currentCode;
            document.getElementById('connection-status').innerText = "Status: 🟢 Secure Server Online & Waiting...";
        });

        peer.on('connection', (conn) => {
            dataChannel = conn;
            console.log("DataChannel connected!");
            document.getElementById('connection-status').innerText = "Status: 🔵 Phone Connected!";
        });

        peer.on('call', (call) => {
            console.log("Answering incoming stream call from phone...");
            document.getElementById('connection-status').innerText = "Status: 🟢 Streaming Active!";
            call.answer(hostStream);
        });

        peer.on('error', (err) => {
            console.error("Host Peer error:", err);
            if (err.type === 'unavailable-id') {
                location.reload();
            }
        });

        hostStream.getVideoTracks()[0].onended = function() {
            alert("Screen sharing ended.");
            location.reload();
        };

    } catch (err) {
        console.error("Screen share error:", err);
        alert("Screen share permission is required!");
        location.reload();
    }
}

function setupClientReceiver() {
    console.log("Initializing receiver peer...");
    peer = new Peer(peerConfig);

    peer.on('open', (id) => {
        console.log("Receiver ready. ID:", id);
        isPeerReady = true;
    });

    peer.on('error', (err) => {
        console.error("Receiver Peer error:", err);
    });
}

// Connect Function for Phone
function connectToRemotePC() {
    const inputCode = document.getElementById('input-pin').value.trim().toUpperCase();
    const errorBox = document.getElementById('error-message');

    if (!isPeerReady) {
        showError("⏳ Network initializing... Please wait 3 seconds.");
        return;
    }

    if (inputCode.length !== 6) {
        showError("Please enter a valid 6-character code!");
        return;
    }

    errorBox.classList.add('hidden');
    const hostId = "KGT-PROD-" + inputCode;

    console.log("Connecting to host ID:", hostId);

    const conn = peer.connect(hostId);
    conn.on('open', () => {
        console.log("DataChannel open!");
    });

    const dummyStream = new MediaStream();
    const call = peer.call(hostId, dummyStream);

    if (!call) {
        showError("❌ Failed to initiate call.");
        return;
    }

    let connected = false;

    call.on('stream', (remoteStream) => {
        connected = true;
        console.log("Stream received successfully on phone!");
        document.getElementById('receiver-box').classList.add('hidden');
        document.getElementById('stream-container').classList.remove('hidden');

        const videoElem = document.getElementById('remote-video');
        videoElem.srcObject = remoteStream;
        videoElem.play().catch(e => console.log("Video play error:", e));

        // Auto Fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log("Fullscreen error:", err));
        }

        // Touch Control Mapping
        videoElem.addEventListener('click', (e) => {
            const rect = videoElem.getBoundingClientRect();
            const x = (e.clientX - rect.left) / videoElem.clientWidth;
            const y = (e.clientY - rect.top) / videoElem.clientHeight;

            if (dataChannel && dataChannel.open) {
                dataChannel.send({ type: 'click', x: x, y: y });
            }
        });
    });

    call.on('error', (err) => {
        console.error("Call error:", err);
        showError("❌ Connection transmission error.");
    });

    setTimeout(() => {
        if (!connected) {
            console.warn("Timeout reached.");
            showError("❌ Host Offline or Invalid Code!");
        }
    }, 12000);
}

function showError(msg) {
    const errorBox = document.getElementById('error-message');
    errorBox.innerText = msg;
    errorBox.classList.remove('hidden');
}

function disconnectStream() {
    location.reload();
}