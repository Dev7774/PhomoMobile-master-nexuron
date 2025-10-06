import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const TASK_NAME = "PHOTO_SYNC_TASK";

export async function triggerBackgroundSyncManually() {
  console.log("🧪 Triggering background task via `triggerTaskWorkerForTestingAsync()`...");

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!isRegistered) {
    console.warn(`❌ Task "${TASK_NAME}" is not registered`);
    return;
  }

  try {
    await BackgroundTask.triggerTaskWorkerForTestingAsync(); // ✅ correct method for testing in dev
    console.log("✅ Background task triggered (testing mode)");
  } catch (err) {
    console.error("❌ Error triggering background task for testing:", err);
  }
}

export async function getBackgroundSyncStatus() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);

    return {
      isTaskRegistered: isRegistered,
      statusText: isRegistered ? "Available" : "Not Registered",
    };
  } catch (error) {
    console.error("Error getting background sync status:", error);
    return null;
  }
}
