import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {
    const uiLayer = document.getElementById('ui-layer');
    const playBtn = document.getElementById('play-btn');
    const serversBtn = document.getElementById('servers-btn');
    const serversModal = document.getElementById('servers-modal');
    const closeServersBtn = document.getElementById('close-servers-btn');
    const serverItems = document.querySelectorAll('.server-item');
    const nicknameInput = document.getElementById('nickname-input');
    
    let selectedServer = 'ws://localhost:8080';
    let gameStarted = false;

    // Load saved nickname if exists
    const savedNickname = localStorage.getItem('snake_nickname');
    if (savedNickname) {
        nicknameInput.value = savedNickname;
    }

    // Modal logic
    serversBtn.addEventListener('click', () => {
        serversModal.classList.remove('hidden');
    });

    closeServersBtn.addEventListener('click', () => {
        serversModal.classList.add('hidden');
    });

    // Close modal when clicking outside
    serversModal.addEventListener('click', (e) => {
        if (e.target === serversModal || e.target.classList.contains('modal-backdrop')) {
            serversModal.classList.add('hidden');
        }
    });

    // Server selection
    serverItems.forEach(item => {
        item.addEventListener('click', () => {
            serverItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedServer = item.dataset.server;
            
            // Auto close modal on selection
            setTimeout(() => {
                serversModal.classList.add('hidden');
            }, 300);
        });
    });

    // Play logic
    playBtn.addEventListener('click', startGameLogic);
    
    // Allow pressing Enter to play
    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startGameLogic();
        }
    });

    function startGameLogic() {
        if (gameStarted) return;
        
        let nickname = nicknameInput.value.trim();
        if (!nickname) {
            nickname = 'Player' + Math.floor(Math.random() * 10000);
        }
        
        // Save nickname
        localStorage.setItem('snake_nickname', nickname);
        
        // Store globals for game to access
        window.gameSettings = {
            nickname: nickname,
            serverUrl: selectedServer
        };
        
        // Hide UI and start game
        uiLayer.classList.add('hidden');
        StartGame('game-container');
        gameStarted = true;
    }
});