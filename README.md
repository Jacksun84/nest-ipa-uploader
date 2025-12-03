Windows Setup Guide - Cross-Platform IPA Upload<br>

🎯 Integrations?<br>
The Tool uses the App Store Connect Upload API which works on Windows, Linux, and macOS without needing xcrun, Xcode, or any Apple-specific tools!<br>

⚡ Quick Setup
1. Install dependecies
Nodejs is required, check the version of node, should work with version v24.4.1<br>
bash<br>
node -v<br>
npm install

2. Create your .env File using the example .env.example

APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx<br>
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX<br>
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\path\to\AuthKey_XXXXXXXXXX.p8<br>

⚠️ Important for Windows: Use forward slashes or double backslashes in paths:
bash
**Good**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:/Users/YourName/keys/AuthKey_XXXXXXXXXX.p8
**or**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\\Users\\YourName\\keys\\AuthKey_XXXXXXXXXX.p8
**Bad**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\Users\YourName\keys\AuthKey_XXXXXXXXXX.p8

3. Rebuild the Project
bash<br>
npm run build

4. Test the Upload
bash<br>
npm run cli -- upload --file artifacts/Sapphire_Care_demo.ipa --bundle-id com.nordicplatforms.demo.SapphireCare --type testflight

🔍 How It Works (Cross-platform):
Windows/Mac/Linux<br> 
✅ App Store Connect API → AWS S3 → Apple (WIP)

The upload process:<br>
Extract IPA metadata (using adm-zip - works on Windows)<br>
Create build record in App Store Connect<br>
Create upload session and get AWS S3 URLs<br>
Upload IPA chunks directly to Apple's AWS storage<br>
Commit upload to finalize<br>

Commands to Run:
bash
# 1. Install new dependency
npm install

# 2. Rebuild
npm run build

# 3. Test
npm run cli -- upload --file path/to/your.ipa --bundle-id your.bundle.id --type testflight


🐛 Troubleshooting
Error: "Failed to create build"
Possible causes:
Build with this version already exists
App Store Connect API key doesn't have proper permissions

Solution:
Ensure your API key has "Admin" or "App Manager" role
Check if build already exists: npm run cli -- list-builds --bundle-id your.bundle.id

Error: "Cannot load private key"
Solution on Windows - Make sure path uses forward slashes or escaped backslashes
bash
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:/Users/<username>/keys/AuthKey_ABC123.p8

Error: "Info.plist not found in IPA"
Solution:
Verify your IPA is valid
Test: npm run cli -- metadata --file your.ipa

Upload is Slow
This is normal! The upload happens in chunks:

Each chunk is uploaded separately to AWS S3
You'll see progress: "Uploading chunk 1/10... Progress: 10%"
Large IPA files (100MB+) can take 5-10 minutes

🎉 Success Indicators<br>
When upload succeeds, you'll see:<br>
✔ Initializing...<br>
✔ Starting upload...<br>
  Step 1/5: Calculating file checksum...<br>
  MD5: abc123...<br>
  Step 2/5: Creating build record...<br>
  Step 3/5: Creating upload session...<br>
  Step 4/5: Uploading file to Apple servers...<br>
  Uploading chunk 1/5...<br>
  Progress: 20.0%<br>
  Uploading chunk 2/5...<br>
  Progress: 40.0%<br>
  ...<br>
  Step 5/5: Finalizing upload...<br>
  ✓ IPA uploaded successfully!<br>
✔ Upload completed successfully!<br>

  Build ID: abc-123-def<br>
  Version: 1.0.0<br>
  Processing State: PROCESSING<br>

🚀 Advanced Usage - Upload Without Waiting<br>
Skip the build processing check (faster):<br>
bash<br>
npm run cli -- upload --file your.ipa --bundle-id your.bundle.id --type testflight --skip-wait

#Add to Beta Group Automatically
bash
## First, get your beta group ID
npm run cli -- list-beta-groups --bundle-id your.bundle.id

![List Tests Groups](/assets/list-beta-groups.png)

## Then upload with beta group
npm run cli -- upload --file your.ipa --bundle-id your.bundle.id --type testflight --beta-group YOUR_BETA_GROUP_ID<br>
📝 API Key Setup Reminder<br>
If you haven't set up your App Store Connect API key yet:<br>

Go to App Store Connect<br>
Click Users and Access → Keys tab<br>
Click "+" to generate a new key<br>
Name it (e.g., "IPA Uploader")<br>
Select "Admin" access (or at least "App Manager")<br>
Click Generate<br>
Download the .p8 file (you can only do this once!)<br>
Copy the Key ID and Issuer ID<br>

Put the .p8 file somewhere safe on your Windows machine and update your .env file with the correct path.<br>
✅ Verification<br>
Test that everything works:<br>
bash

### 1. Test credentials
npm run cli -- list-apps

![List Apps example](/assets/list-apps.png)

### 2. Test IPA metadata extraction
npm run cli -- metadata -f your.ipa

### 3. List Builds
npm run cli -- list-builds -b your.bundle.id

### 4. List Build Details
npm run cli -- list-build-details -b your.bundle.id -bvi build.version.id

### 5. Analyze IPA metadata
npm run cli -- analyze -f your.bundle.id

### 6. Test upload (WIP)
npm run cli -- upload -file your.ipa --bundle-id your.bundle.id --type testflight

### 7. Upload IPA file (WIP)
npm run cli -- multipart-upload -f your.ipa -a bundle-id --short-version 3.31 --build-version 108

You're all set! Your tool now works on Windows! 🎊