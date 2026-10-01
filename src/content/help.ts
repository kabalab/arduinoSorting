export type HelpAudience = "guest" | "member" | "admin";

export type HelpSection = {
  heading: string;
  paragraphs: string[];
};

const guest: HelpSection[] = [
  {
    heading: "Access codes",
    paragraphs: [
      "An access code is the private pass for one person. It is not your name and it is not an account password you invent on this screen.",
      "Ask an administrator if you do not have a code. Codes are checked on the server and are never saved in this browser.",
    ],
  },
  {
    heading: "Continue",
    paragraphs: [
      "Type the code and choose Continue. If the code matches, you go straight to your dashboard. If it does not, you stay here and can try again.",
    ],
  },
  {
    heading: "Staying signed in",
    paragraphs: [
      "A successful Continue keeps you signed in on this browser. You can close the tab and come back without entering the code again until you log out, switch accounts, or the session expires.",
    ],
  },
  {
    heading: "Log out or switch accounts",
    paragraphs: [
      "Log out and Switch account both end the session and bring you back to this screen. Use Switch account when another person needs to sign in on the same browser.",
    ],
  },
];

const member: HelpSection[] = [
  {
    heading: "Find supplies",
    paragraphs: [
      "The Supplies page lists what your group is allowed to request. Each card shows the name, how many are available, the category, and a short description.",
      "If a supply is hidden from your group, it will not appear here and a request for it will be rejected.",
    ],
  },
  {
    heading: "Search and quantities",
    paragraphs: [
      "Use the search box to filter by name, category, or description. Set a quantity with the stepper, then choose Add to Request.",
      "The request cart holds those choices in this tab only. Refreshing the page clears the cart.",
    ],
  },
  {
    heading: "Expected return and submit",
    paragraphs: [
      "Open the request cart, check the quantities, and set the date you expect to bring the items back. Submit stays off, with a short reason, until the date is set and every quantity is still available.",
      "Leave the button alone while it says it is submitting. That prevents the same request from being sent twice.",
    ],
  },
  {
    heading: "Statuses",
    paragraphs: [
      "Pending means an administrator still needs to approve the request. Checked Out means the items are with you. Returned means every item is back. Denied includes the reason when one was given. Cancelled means you withdrew a pending request.",
      "Overdue appears when a checked-out request is past its expected return date and something is still out. The original record is not erased.",
    ],
  },
  {
    heading: "Your group's approval setting",
    paragraphs: [
      "If your group is set to automatic approval, a request checks out as soon as you submit it and the supplies are available.",
      "If your group requires approval, the request stays Pending until an administrator approves it. Approval checks the items out immediately. There is no separate step to mark them as taken.",
    ],
  },
];

const admin: HelpSection[] = [
  {
    heading: "Add and edit supplies",
    paragraphs: [
      "Inventory is where you add a supply, edit its name, description, category, and optional image address, and change how many are available.",
      "The name field suggests existing supplies as you type. Choosing a suggestion opens that supply. Create a new name only when you mean to add a different item.",
      "Use the stepper to add or remove available units. Removing a supply asks you to confirm and is blocked while any units are still checked out. Past ledger lines stay in History.",
    ],
  },
  {
    heading: "Who cannot request an item",
    paragraphs: [
      "On add and edit, the checklist labeled Who cannot request this hides that supply from the groups you select. Leave it empty and anyone signed in can request it.",
      "The supply page says this in plain language, such as Anyone can request this or Hidden from Robotics.",
    ],
  },
  {
    heading: "Approve or deny",
    paragraphs: [
      "The Requests page lists pending requests. Approve checks the stock again and, if enough is available, checks the items out. Deny can include a short reason the requester will see.",
      "Filters narrow the list by group, status, person, item, and expected return date. Approved in the filter means the request was approved. After approval the live status is Checked Out.",
    ],
  },
  {
    heading: "Full and partial returns",
    paragraphs: [
      "Checked out lists open loans, including how many days overdue. Mark Returned records the quantities that actually came back.",
      "A partial return increases stock only by that amount and leaves the request Checked Out. When every line is fully returned, the request becomes Returned.",
    ],
  },
  {
    heading: "Groups and access codes",
    paragraphs: [
      "Groups have a name and an approval mode. Automatic means requests check out on submit when stock allows. Required means they wait for approval.",
      "Users / Access is where you add a person, assign a group and role, and set or rotate an access code. The code is shown once. After that only a hash is stored.",
    ],
  },
  {
    heading: "History and settings",
    paragraphs: [
      "History is a searchable list of requests and stock changes. Settings changes the site name shown in the header. Connecting a database is a later step and does not change these screens.",
    ],
  },
];

export function helpSections(audience: HelpAudience): HelpSection[] {
  if (audience === "guest") return guest;
  if (audience === "member") return member;
  return [...member, ...admin];
}
