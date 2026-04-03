import React from 'react';

const DownloadApp = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 font-display">Install Our App</h1>
      <p className="mb-8 text-gray-600">
        Get the best experience by installing our app directly to your home screen. No app store required!
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* iOS Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            iOS (iPhone & iPad)
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
            <li>Open this website in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button at the bottom of the screen.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong> in the top right corner.</li>
          </ol>
        </div>

        {/* Android Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            Android
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
            <li>Open this website in <strong>Chrome</strong>.</li>
            <li>Tap the <strong>Menu</strong> icon (three dots) at the top right.</li>
            <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            <li>Follow the on-screen prompts to install.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DownloadApp;