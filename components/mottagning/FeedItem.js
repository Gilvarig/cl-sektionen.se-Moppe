import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

import feed_styles from "../../styles/mottagning/mottagning.module.css";

export default function FeedItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [maxHeight, setMaxHeight] = useState(null);

  const contentRef = useRef(null);

  useEffect(() => {
    const rem = parseInt(getComputedStyle(document.documentElement).fontSize);
    if (contentRef.current.scrollHeight > 4.5 * rem) {
      setMaxHeight(contentRef.current.scrollHeight);
    }
  }, []);

  const urlify = (text) => {
    const urlRegex = /(([\w+]+\:\/\/)?([\w\d-]+\.)*[\w-]+[\.\:]\w+([\/\?\=\&\#\.\]?[\w-]+)*\/?)/gm;
    const urls = text.match(urlRegex) || [];

    let strings = [];
    let newStrings = [, text];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      newStrings = newStrings[1].split(url);
      strings.push(newStrings[0]);
    }
    strings.push(newStrings[1]);

    return (
      <>
        {strings.map((string, idx) => {
          return (
            //React fragment för att kunna sätta en key
            <React.Fragment key={idx}>
              {idx > 0 && (
                <Link
                  href={!urls[idx - 1].includes("//") ? "https://" + urls[idx - 1] : urls[idx - 1]}
                  target="_blank">
                  {urls[idx - 1]}
                </Link>
              )}
              {string}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  return (
    <div
      className={`${feed_styles.feedItem} ${(expanding) ? feed_styles.expanding : ""} ${expanded? feed_styles.expanded : ""}`}
      onClick={() => {
        setExpanded(!expanded)
      }}>
      <h3>{item.title}</h3>
      <p
        ref={contentRef}>
        {urlify(item.content)}
      </p>
      {maxHeight && <span>{expanding && expanded ? "Visa mindre" : "Visa mer"}</span>}
    </div>
  );
}
