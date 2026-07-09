import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/index.js';
import { EthersAdapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers@latest/dist/esm/index.js';
import { mainnet } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@latest/dist/esm/networks.js';

const PROJECT_ID = '7ee282b2996b54334564e0f64beebed1';
const PLATFORM_URL = 'https://lidostake.org';

const LIDO_CONTRACTS = {
    lido: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    withdrawalQueue: '0x889edC2eDab8f4B4f2d89abf85dE641d39e3d58D',
};

const LIDO_ABI = [
    "function submit(address _referral) external payable returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
    "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const appKit = createAppKit({
    adapters: [new EthersAdapter()],
    projectId: PROJECT_ID,
    networks: [mainnet],
    metadata: {
        name: 'Lido Stake',
        description: 'Liquid ETH Staking Platform',
        url: PLATFORM_URL,
        icons: [`${PLATFORM_URL}/icon.png`]
    },
    themeMode: 'dark'
});

let provider = null;
let signer = null;
let userAddress = null;
let lidoContract = null;
let ethBalance = 0;
let stethBalance = 0;

// Note: DOM elements are looked up at runtime inside init/start to ensure the DOM is ready.

async function init() {
    try {
        const walletProvider = appKit.getWalletProvider();
        if (walletProvider) await handleConnect();
    } catch (e) {}
    
    appKit.subscribeProviders(async (providers) => {
        if (providers.eip155) await handleConnect();
        else handleDisconnect();
    });
    
    const stakeElem = document.getElementById('stakeAmount');
    if (stakeElem) {
        stakeElem.addEventListener('input', updateAnnualReward);
    }
}

async function handleConnect() {
    try {
        const walletProvider = appKit.getWalletProvider();
        if (!walletProvider) return;
        
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        
        provider = new ethers.BrowserProvider(walletProvider);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        lidoContract = new ethers.Contract(LIDO_CONTRACTS.lido, LIDO_ABI, signer);
        
        updateWalletUI();
        await updateBalances();
        showNotification('Wallet connected!', 'success');
    } catch (error) {
        showNotification('Connection failed', 'error');
    }
}

function handleDisconnect() {
    provider = signer = userAddress = lidoContract = null;
    // update UI to default
    const btn = document.getElementById('connectBtn');
    if (btn) btn.textContent = 'Connect Wallet';
    const ethEl = document.getElementById('ethBalance');
    const userStethEl = document.getElementById('userSteth');
    if (ethEl) ethEl.textContent = '0.00';
    if (userStethEl) userStethEl.textContent = '0.00';
}

function updateWalletUI() {
    const btn = document.getElementById('connectBtn');
    if (!btn) return;
    if (userAddress) {
        btn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        btn.classList.add('connected');
        const stakeBtn = document.getElementById('stakeBtn');
        if (stakeBtn) { stakeBtn.textContent = 'Stake ETH'; stakeBtn.disabled = false; }
        const unstakeBtn = document.getElementById('unstakeBtn');
        if (unstakeBtn) { unstakeBtn.textContent = 'Request Withdrawal'; unstakeBtn.disabled = false; }
    } else {
        btn.textContent = 'Connect Wallet';
        btn.classList.remove('connected');
        const stakeBtn = document.getElementById('stakeBtn');
        if (stakeBtn) stakeBtn.textContent = 'Connect Wallet to Stake';
        const unstakeBtn = document.getElementById('unstakeBtn');
        if (unstakeBtn) { unstakeBtn.textContent = 'Connect Wallet to Unstake'; unstakeBtn.disabled = true; }
    }
}

async function updateBalances() {
    if (!provider || !userAddress || !lidoContract) return;
    try {
        const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
        
        const balance = await provider.getBalance(userAddress);
        ethBalance = parseFloat(ethers.formatEther(balance));
        const ethEl = document.getElementById('ethBalance');
        if (ethEl) ethEl.textContent = ethBalance.toFixed(4);
        const unstakeAvailableEl = document.getElementById('unstakeAvailable');
        if (unstakeAvailableEl) unstakeAvailableEl.textContent = ethBalance.toFixed(4);
        
        const stethBal = await lidoContract.balanceOf(userAddress);
        stethBalance = parseFloat(ethers.formatEther(stethBal));
        const userStethEl = document.getElementById('userSteth');
        if (userStethEl) userStethEl.textContent = stethBalance.toFixed(4);
        const stethDisplay = document.getElementById('stethBalanceDisplay');
        if (stethDisplay) stethDisplay.textContent = stethBalance.toFixed(4) + ' stETH';
        
        const rewards = stethBalance > 0 ? (stethBalance * 0.038) : 0;
        const rewardsEl = document.getElementById('rewardsEarned');
        if (rewardsEl) rewardsEl.textContent = '+' + rewards.toFixed(4) + ' ETH';
        
        const usdValue = stethBalance * 3000;
        const currentValueEl = document.getElementById('currentValue');
        if (currentValueEl) currentValueEl.textContent = '$' + usdValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    } catch (error) {
        console.error('Balance error:', error);
    }
}

window.stakeETH = async function() {
    if (!signer || !lidoContract) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const stakeAmountEl = document.getElementById('stakeAmount');
    const amount = stakeAmountEl ? parseFloat(stakeAmountEl.value) : NaN;
    
    if (!amount || amount <= 0) {
        showNotification('Enter valid amount', 'error');
        return;
    }
    if (amount > ethBalance) {
        showNotification('Insufficient ETH', 'error');
        return;
    }
    
    try {
        const stakeBtn = document.getElementById('stakeBtn');
        if (stakeBtn) { stakeBtn.disabled = true; stakeBtn.textContent = 'Processing...'; }
        
        const value = ethers.parseEther(amount.toString());
        const tx = await lidoContract.submit(ethers.ZeroAddress, { value });
        await tx.wait();
        
        showNotification(`Staked ${amount} ETH!`, 'success');
        if (stakeAmountEl) stakeAmountEl.value = '';
        updateAnnualReward();
        await updateBalances();
    } catch (error) {
        showNotification('Transaction failed', 'error');
    } finally {
        const stakeBtn = document.getElementById('stakeBtn');
        if (stakeBtn) { stakeBtn.disabled = false; stakeBtn.textContent = 'Stake ETH'; }
    }
};

window.unstakeETH = async function() {
    if (!signer) {
        await appKit.open();
        return;
    }
    
    const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js');
    const amount = parseFloat(document.getElementById('unstakeAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Enter valid amount', 'error');
        return;
    }
    if (amount > stethBalance) {
        showNotification('Insufficient stETH', 'error');
        return;
    }
    
    try {
        const unstakeBtn = document.getElementById('unstakeBtn');
        if (unstakeBtn) { unstakeBtn.disabled = true; unstakeBtn.textContent = 'Processing...'; }
        
        const withdrawalQueue = new (await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js')).ethers.Contract(
            LIDO_CONTRACTS.withdrawalQueue,
            ["function requestWithdrawals(uint256[] calldata _amounts, address _owner) external returns (uint256[] memory requestIds)"],
            signer
        );
        
        const ethAmount = (await import('https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js')).ethers.parseEther(amount.toString());
        const shares = await lidoContract.getSharesByPooledEth(ethAmount);
        
        const tx = await withdrawalQueue.requestWithdrawals([shares], userAddress);
        await tx.wait();
        
        showNotification('Withdrawal requested!', 'success');
        const unstakeEl = document.getElementById('unstakeAmount');
        if (unstakeEl) unstakeEl.value = '';
        await updateBalances();
    } catch (error) {
        showNotification('Transaction failed', 'error');
    } finally {
        const unstakeBtn = document.getElementById('unstakeBtn');
        if (unstakeBtn) { unstakeBtn.disabled = false; unstakeBtn.textContent = 'Request Withdrawal'; }
    }
};

window.setMaxStake = function() {
    if (ethBalance > 0.01) {
        const stakeElem = document.getElementById('stakeAmount');
        if (stakeElem) {
            stakeElem.value = (ethBalance - 0.01).toFixed(4);
            updateAnnualReward();
        }
    }
};

window.setMaxUnstake = function() {
    if (stethBalance > 0) {
        const unstakeEl = document.getElementById('unstakeAmount');
        if (unstakeEl) unstakeEl.value = stethBalance.toFixed(4);
    }
};

function updateAnnualReward() {
    const stakeElem = document.getElementById('stakeAmount');
    const amount = stakeElem ? parseFloat(stakeElem.value) || 0 : 0;
    const reward = amount * 0.038;
    const el = document.getElementById('annualReward');
    if (el) el.textContent = `+${reward.toFixed(4)} ETH`;
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notificationIcon');
    const text = document.getElementById('notificationText');
    if (!notification || !icon || !text) return;
    
    notification.className = 'notification ' + type;
    icon.textContent = type === 'success' ? '✓' : '✕';
    text.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Exported start function — initializes the app once the DOM is ready.
export async function startApp() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    // Initialize UI bindings and listeners
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            if (!userAddress) await appKit.open();
        });
    }

    // Call init to wire providers and update flows
    await init();
}

// Auto-start when loaded in a browser (but allow opt-out via Vite env)
if (typeof window !== 'undefined' && !import.meta.env?.VITE_NO_AUTO_START) {
    startApp().catch(err => console.error('App start error', err));
}
