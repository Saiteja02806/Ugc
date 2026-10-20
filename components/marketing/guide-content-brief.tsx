"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function GuideContentBrief({
  id,
  fields,
}: {
  id: string;
  fields: readonly string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [brief, setBrief] = useState(() =>
    fields.map((field) => `${field.split(":")[0]}:`).join("\n\n"),
  );

  return (
    <div className="mt-5 rounded-lg border border-border bg-card p-5 sm:p-6">
      <ul hidden={isEditing} className="space-y-3 text-[15px] leading-7 text-foreground">
        {fields.map((field) => <li key={field}>{field}</li>)}
      </ul>
      <div id={id} hidden={!isEditing}>
        <label htmlFor={`${id}-text`} className="block text-sm font-medium text-foreground-strong">
          Your content brief
        </label>
        <textarea
          id={`${id}-text`}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          rows={12}
          spellCheck
          className="mt-3 block w-full resize-y rounded-md border border-border-strong bg-background p-3 text-base leading-7 text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-5 min-h-11"
        aria-expanded={isEditing}
        aria-controls={id}
        onClick={() => setIsEditing((previous) => !previous)}
      >
        {isEditing ? "View the template" : "Use a blank brief"}
      </Button>
    </div>
  );
}
