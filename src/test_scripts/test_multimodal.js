const fs = require("fs");
const path = require("path");

async function runMultimodalTests() {
  console.log("🚀 Starting Multimodal Features Integration Test Suite...");

  const { parseDocument } = require("../services/parser");

  const mockFiles = [
    { name: "9.Social Network Analysis.pptx", type: "pptx" },
    { name: "image 3 - Copy - Copy - Copy - Copy.jpeg", type: "jpeg" },
    { name: "audio.wav", type: "wav" },
    { name: "kennedy.mp4", type: "mp4" }
  ];

  for (const mockFile of mockFiles) {
    console.log(`\n📄 Testing Parser on: ${mockFile.name} (type: ${mockFile.type})`);
    try {
      const filePath = path.join(__dirname, "..", "..", "ai_docs", "mock_docs", mockFile.name);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Mock file not found: ${filePath}`);
        continue;
      }
      
      const buffer = fs.readFileSync(filePath);
      const startTime = Date.now();
      const parsedText = await parseDocument(buffer, mockFile.type);
      const duration = Date.now() - startTime;

      console.log(`✅ Success! Parsed in ${duration}ms.`);
      console.log(`- Preview (first 150 chars): "${parsedText.substring(0, 150).replace(/\n/g, " ")}..."`);
    } catch (err) {
      console.error(`❌ Parse failed for ${mockFile.name}:`, err);
    }
  }

  console.log("\n🎉 Multimodal parse integration test completed!");
}

runMultimodalTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
