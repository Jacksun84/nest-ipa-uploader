Release Notes<br>
20260730 - Analyze IPA file improvement to successfully retrieve the build versions (bundle_short_version_string & CFBundleVersion from config.xml file)<br>


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
<br>bash<br>
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx<br>
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX<br>
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\path\to\AuthKey_XXXXXXXXXX.p8<br>

<br>
⚠️ Important for Windows: Use forward slashes or double backslashes in paths:
<br>
**Good**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:/Users/YourName/keys/AuthKey_XXXXXXXXXX.p8
**or**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\\Users\\YourName\\keys\\AuthKey_XXXXXXXXXX.p8
**Bad**
APP_STORE_CONNECT_PRIVATE_KEY_PATH=C:\Users\YourName\keys\AuthKey_XXXXXXXXXX.p8

3. Rebuild the Project
<br>bash
npm run build

4. Upload ipa file
<br>bash
npm run cli -- multipart-upload -f your.ipa -b bundle-id --short-version build.version.number --build-version build.version.code

🔍 How It Works (Cross-platform):
Windows/Mac/Linux<br> 

The upload process:<br>
Extract IPA metadata (using adm-zip - works on Windows)<br>
Create build record in App Store Connect<br>
Create build upload multi part in App Store Connect<br>
Commit upload to finalize<br>

Commands to Run:
bash
# 1. Install new dependency
npm install

# 2. Rebuild
npm run build

# 3. Test
npm run cli -- multipart-upload -f your.ipa -b bundle-id --short-version build.version.number --build-version build.version.code


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

Each chunk is uploaded separately to Apple Store Connect
You'll see progress: "Uploading chunk 1/10... Progress: 10%"
Large IPA files (100MB+) can take 5-10 minutes

🎉 Success Indicators<br>
Uploading part 1 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 2 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 3 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 4 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 9 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 10 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 11 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 12 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 13 with length 5242880...<br>
Finalizing upload part...<br>
 200<br>
Uploading part 14 with length 4974770...<br>
Finalizing upload part...<br>
 200<br>
✔ All parts uploaded<br>
✔ Multipart upload committed<br>


#Add to Beta Group Automatically
bash
## First, get your beta group ID
npm run cli -- list-beta-groups --bundle-id your.bundle.id

![List Tests Groups](/assets/list-beta-groups.png)

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

### 2. Analyze IPA metadata
npm run cli -- analyze -f your.ipa

![IPA file analysis](/assets/ipa-analyze.png)

### 3. List Builds
npm run cli -- list-builds -b your.bundle.id

### 4. List Build Details
npm run cli -- list-build-details -b your.bundle.id -bvi build.version.id

### 5. Upload IPA file
npm run cli -- multipart-upload -f your.ipa -b bundle-id --short-version build.version.number --build-version build.version.code

![Upload IPA file 01](/assets/ipa-uploader-01.png)
![Upload IPA file 02](/assets/ipa-uploader-02.png)

### 6. Test upload (WIP)
npm run cli -- upload -file your.ipa --bundle-id your.bundle.id --type testflight

You're all set! Your tool now works on Windows! 🎊
