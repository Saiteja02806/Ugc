"use client";

import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import styles from "./person-photo-guide.module.css";

const examples = [
  { title: "Main face photo", angle: "Face the camera", position: "0%", description: "Choose a sharp, front-facing photo. Keep your full face visible, with no hand, hair or sunglasses covering it." },
  { title: "Supporting photo 1", angle: "Turn slightly to one side", position: "50%", description: "Show the same person from a different angle so their cheek, nose and jaw are easier to see." },
  { title: "Supporting photo 2", angle: "Turn to the other side", position: "100%", description: "Add the opposite view with similar lighting. A different angle is more useful than repeating the same photo." },
];

/** Instructional examples only; never enter the user's selected references. */
export function PersonPhotoGuide() {
  return <Dialog>
    <DialogTrigger render={<Button type="button" variant="ghost" size="sm" className={styles.trigger} />}>
      <BookOpen aria-hidden="true" className="size-4" />
      Photo guide &amp; examples
    </DialogTrigger>
    <DialogContent className={styles.dialog}>
      <header className={styles.header}>
        <DialogTitle className={styles.title}>Which photos should I use?</DialogTitle>
        <DialogDescription className={styles.description}>Start with one clear face photo. Add two different views of the same person when you have them.</DialogDescription>
      </header>
      <div className={styles.content}>
        <div className={styles.examples}>
          {examples.map(example => <figure key={example.title} className={styles.example}>
            <div className={styles.image}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/explore/guidance/person-views.webp" width={900} height={300}
                alt={`AI-generated example: ${example.angle.toLowerCase()}.`}
                decoding="async" style={{ objectPosition: example.position }} />
            </div>
            <figcaption>
              <h3>{example.title}</h3>
              <strong>{example.angle}</strong>
              <p>{example.description}</p>
            </figcaption>
          </figure>)}
        </div>
        <div className={styles.tips}>
          <p><strong>Choose the main photo yourself.</strong> The first photo you select becomes the main photo. Use “Use as main” to change it.</p>
          <p><strong>Focus on the face.</strong> Use even light and natural detail, without beauty filters. There is no required 9:16 or 4:5 ratio, and you don’t need a waist-up photo for a face change.</p>
        </div>
        <p className={styles.note}>AI-generated examples for guidance only. These photos are never added to your video. Different views can provide more detail; results still depend on the model.</p>
      </div>
      <footer className={styles.footer}>
        <DialogClose render={<Button type="button" variant="outline" />}>Back to my photos</DialogClose>
      </footer>
    </DialogContent>
  </Dialog>;
}
