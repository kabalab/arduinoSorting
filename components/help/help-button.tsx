"use client";

import { useState } from "react";
import { helpSections, type HelpAudience } from "@/src/content/help";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function HelpButton({ audience }: { audience: HelpAudience }) {
  const [open, setOpen] = useState(false);
  const sections = helpSections(audience);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Help
      </Button>
      <Dialog open={open} title="Help" onClose={() => setOpen(false)}>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          {sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-medium">{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-1 text-sm leading-6 text-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Dialog>
    </>
  );
}
