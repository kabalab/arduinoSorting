import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateAccessCode, hashAccessCode } from "@/src/auth/codes";
import { todayDateString, type StoreData } from "@/src/domain";

export const STORE_PATH = path.join(process.cwd(), "data", "store.json");
export const CODES_PATH = path.join(process.cwd(), "data", "initial-codes.txt");

function shiftDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayDateString(date);
}

export async function createSeed(): Promise<StoreData> {
  const adminCode = generateAccessCode();
  const arduinoCode = generateAccessCode();
  const roboticsCode = generateAccessCode();
  const [adminHash, arduinoHash, roboticsHash] = await Promise.all([
    hashAccessCode(adminCode),
    hashAccessCode(arduinoCode),
    hashAccessCode(roboticsCode),
  ]);

  const createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const store: StoreData = {
    settings: { siteName: "Equipment storage" },
    groups: [
      { id: "group-arduino", name: "Arduino", approvalMode: "automatic" },
      { id: "group-robotics", name: "Robotics", approvalMode: "required" },
    ],
    users: [
      { id: "user-admin", displayName: "Ada Okonkwo", role: "admin", groupId: "group-arduino" },
      { id: "user-arduino", displayName: "Alex Chen", role: "member", groupId: "group-arduino" },
      { id: "user-robotics", displayName: "Jordan Lee", role: "member", groupId: "group-robotics" },
    ],
    credentials: [
      { userId: "user-admin", codeHash: adminHash },
      { userId: "user-arduino", codeHash: arduinoHash },
      { userId: "user-robotics", codeHash: roboticsHash },
    ],
    items: [
      {
        id: "item-uno",
        name: "Arduino Uno",
        description: "A small board for class projects and prototypes.",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 5,
        checkedOut: 1,
      },
      {
        id: "item-mega",
        name: "Arduino Mega",
        description: "More pins for larger builds.",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 4,
        checkedOut: 0,
      },
      {
        id: "item-jumpers",
        name: "Jumper wires",
        description: "A pack of male-to-male jumper wires.",
        category: "Cables",
        imageUrl: "",
        requestBlacklist: [],
        available: 40,
        checkedOut: 0,
      },
      {
        id: "item-ultrasonic",
        name: "Ultrasonic sensor",
        description: "Measures distance for robotics projects.",
        category: "Sensors",
        imageUrl: "",
        requestBlacklist: [],
        available: 8,
        checkedOut: 0,
      },
      {
        id: "item-servo",
        name: "Servo",
        description: "A small hobby servo motor.",
        category: "Motors",
        imageUrl: "",
        requestBlacklist: ["group-robotics"],
        available: 6,
        checkedOut: 0,
      },
    ],
    ledger: [
      { id: "ledger-uno", itemId: "item-uno", itemName: "Arduino Uno", delta: 6, kind: "added", actorId: "user-admin", at: createdAt },
      { id: "ledger-mega", itemId: "item-mega", itemName: "Arduino Mega", delta: 4, kind: "added", actorId: "user-admin", at: createdAt },
      { id: "ledger-jumpers", itemId: "item-jumpers", itemName: "Jumper wires", delta: 40, kind: "added", actorId: "user-admin", at: createdAt },
      { id: "ledger-ultrasonic", itemId: "item-ultrasonic", itemName: "Ultrasonic sensor", delta: 8, kind: "added", actorId: "user-admin", at: createdAt },
      { id: "ledger-servo", itemId: "item-servo", itemName: "Servo", delta: 6, kind: "added", actorId: "user-admin", at: createdAt },
      {
        id: "ledger-uno-out",
        itemId: "item-uno",
        itemName: "Arduino Uno",
        delta: -1,
        kind: "checked_out",
        actorId: "user-arduino",
        at: createdAt,
        requestId: "request-overdue",
      },
    ],
    requests: [
      {
        id: "request-overdue",
        groupId: "group-arduino",
        requesterId: "user-arduino",
        createdAt,
        expectedReturn: shiftDate(-2),
        status: "checked_out",
        approvedAt: createdAt,
        approvedBy: "user-arduino",
        checkedOutAt: createdAt,
        lines: [{ itemId: "item-uno", quantityRequested: 1, quantityCheckedOut: 1, quantityReturned: 0 }],
      },
      {
        id: "request-pending",
        groupId: "group-robotics",
        requesterId: "user-robotics",
        createdAt: new Date().toISOString(),
        expectedReturn: shiftDate(7),
        status: "pending",
        lines: [{ itemId: "item-ultrasonic", quantityRequested: 2, quantityCheckedOut: 0, quantityReturned: 0 }],
      },
    ],
  };

  const lines = [
    "These access codes were created once. Only their hashes are stored in the app.",
    "",
    `Admin — Ada Okonkwo — ${adminCode}`,
    `Arduino — Alex Chen — ${arduinoCode}`,
    `Robotics — Jordan Lee — ${roboticsCode}`,
    "",
  ];
  await mkdir(path.dirname(CODES_PATH), { recursive: true });
  await writeFile(CODES_PATH, lines.join("\n"), "utf8");
  console.info(`\nEquipment storage demo access codes (also saved to ${CODES_PATH}):\n${lines.join("\n")}`);
  return store;
}
