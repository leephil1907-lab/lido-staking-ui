# Vercel Deployment Guide

## Pre-Deployment Checklist

- [ ] All code committed and pushed to GitHub
- [ ] Environment variables configured in Vercel
- [ ] Build system tested locally (`npm run build`)
- [ ] No secrets or private keys in code

## Step-by-Step Deployment

### 1. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select "GitHub" and authenticate
4. Search for `lido-staking-ui`
5. Click "Import"

### 2. Configure Environment Variables

In the Vercel project settings, add the following environment variables:

**Production Environment:**

```
VITE_PROJECT_ID = <your_reown_project_id>
VITE_CONTRACT_ADDRESS = 0xae7ab96520de3a18e5e111b5eaab095312d7fe84
VITE_NETWORK_ID = 1
VITE_RPC_URL = <your_infura_or_alchemy_mainnet_rpc>
```

**Preview/Staging Environment (optional):**

```
VITE_PROJECT_ID = <your_reown_project_id>
VITE_CONTRACT_ADDRESS = 0xdd134860959f5d548f799481e14c44958534f4e6
VITE_NETWORK_ID = 5
VITE_RPC_URL = <your_infura_or_alchemy_goerli_rpc>
```

### 3. Build Configuration

- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

*These are auto-detected by Vercel from `vercel.json` and `package.json`*

### 4. Deploy

Click the "Deploy" button. Vercel will:

1. Install dependencies
2. Build your Vite app
3. Deploy to CDN
4. Provide you with a unique URL

### 5. Monitor Deployment

- Check deployment logs in the "Deployments" tab
- Preview the site before production promotion
- Set up custom domain in "Settings" > "Domains"

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_PROJECT_ID` | Reown AppKit Project ID (required) | `a1b2c3d4...` |
| `VITE_CONTRACT_ADDRESS` | Lido staking contract address | `0xae7ab96520de3a18e5e111b5eaab095312d7fe84` |
| `VITE_NETWORK_ID` | Blockchain network ID | `1` (mainnet) or `5` (goerli) |
| `VITE_RPC_URL` | JSON-RPC endpoint (optional) | `https://mainnet.infura.io/v3/...` |

## Get Your Configuration Values

### Reown AppKit Project ID

1. Go to https://cloud.reown.com
2. Create or select your project
3. Copy the **Project ID**
4. Add to Vercel environment as `VITE_PROJECT_ID`

### Infura RPC Endpoint

1. Go to https://infura.io
2. Create account and project
3. Copy the **Ethereum Mainnet** endpoint
4. Add to Vercel environment as `VITE_RPC_URL`

### Contract Addresses

**Lido Staking Contract:**
- **Mainnet:** `0xae7ab96520de3a18e5e111b5eaab095312d7fe84`
- **Goerli:** `0xdd134860959f5d548f799481e14c44958534f4e6`

## Troubleshooting

### Build Fails

```bash
# Test build locally first
npm install
npm run build
```

**Common issues:**
- Node version mismatch: Ensure Node 18+ is installed
- Missing environment variables: Check all `VITE_*` variables are set
- Vite cache: Delete `node_modules` and `.next` folders, reinstall

### Runtime Errors

1. **Wallet Connection Fails:** Verify `VITE_PROJECT_ID` is correct
2. **Contract Interaction Fails:** Check `VITE_CONTRACT_ADDRESS` and `VITE_NETWORK_ID`
3. **Network Errors:** Ensure `VITE_RPC_URL` is accessible

### Performance Optimization

The `vercel.json` includes:

- **Static Asset Caching:** Long-lived cache headers for `/assets/`
- **HTML Caching:** Short-lived cache for `index.html`
- **SPA Rewrites:** All routes redirect to `index.html` for client-side routing
- **Regional Deployment:** Deployed to `iad1` (N. Virginia) for latency

To change regions, edit `vercel.json`:

```json
"regions": ["iad1", "sin1", "cdg1"]
```

## Post-Deployment

### Custom Domain

1. In Vercel project settings, go to "Domains"
2. Add your domain
3. Update DNS records with Vercel's nameservers

### CI/CD

Vercel automatically deploys when you push to:
- `main` → Production
- Other branches → Preview URLs

## Rollback

To revert a deployment:

1. Go to Vercel "Deployments" tab
2. Find the previous successful deployment
3. Click "Promote to Production"

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Configuration](https://vitejs.dev/config/)
- [Reown AppKit Docs](https://docs.reown.com/appkit)
- [Ethers.js Documentation](https://docs.ethers.org/)
