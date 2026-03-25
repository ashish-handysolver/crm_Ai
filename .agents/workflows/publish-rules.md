---
description: How to Publish Firestore Security Rules manually via Firebase Console
---

If you don't have the Firebase CLI installed, you must manually publish your rules in the Firebase Console.

1.  **Open Firebase Console**: Go to [console.firebase.google.com](https://console.firebase.google.com/).
2.  **Select Project**: Click on your project (**gen-lang-client-0004919353**).
3.  **Go to Firestore**: In the left sidebar, click **Build** > **Firestore Database**.
4.  **Select Database**: 
    - At the top of the Firestore page, look for the database selector (it usually says `(default)`).
    - **Click it and select `ai-studio-a51e591f-052c-4aab-ac9b-b7ec428bbf63`**.
5.  **Open Rules Tab**: Click the **Rules** tab at the top.
6.  **Update Rules**:
    - Select all existing code in the editor and delete it.
    - Copy the contents of your local [firestore.rules](file:///g:/crm/crm_Ai/firestore.rules) file.
    - Paste it into the Firebase Console editor.
7.  **Publish**: Click the blue **Publish** button at the top right.
8.  **Wait and Retry**: Wait about 30-60 seconds for the changes to propagate, then go back to your app and click **Retry Refresh**. (Or simply refresh the browser tab).
