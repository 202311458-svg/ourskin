"use client";

import Navbar from "@/app/components/Navbar";
import styles from "./updates.module.css";
import { useEffect, useState } from "react";

const mainPost = "https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/photo?fbid=122176055342827592&set=a.122110106210827592";
const recentPosts = [
  "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid0PnrArq8x5gFc1PDN9vgoeGLHpFGnPqTptreVAqbMUp9gLV6jwJFDK7AKJi5J2fMxl%26id%3D61574827784283",
  "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02Z4pHeiRVxZvPZ6fW5f7G9focTtoFFvLUUndkiGj2P9PU4EGfHFJNz3hkkZbZ5RFxl%26id%3D61574827784283"
];
const featuredPosts = [
  "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid0qZtjvgaDg3onjq6Fa5sTKWpaEY4XnYpaVMTAUugKYJXkbt65zKosTyiCQpAoZSVl%26id%3D61574827784283",
  "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02tpKZtVqZdDxsZVQ8KbCKBzJWE2ZELE2nW21Bkgwgj62rtjH51YJBtfzBqQkxB8ZXl%26id%3D61574827784283",
  "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02HYvcmy3g2uxRL1UKsKXqYMqsThe46iPFVeaSCAHPts7pxfNX72MTYZ5t3ZxLvyVKl%26id%3D61574827784283"
];

export default function UpdatesPage() {
  const [collapsed, setCollapsed] = useState(false);

  // Listen for navbar collapse events
  useEffect(() => {
    const handleCollapse = (e: CustomEvent<boolean>) => setCollapsed(e.detail);
    window.addEventListener("navbarToggle", handleCollapse as EventListener);
    return () => window.removeEventListener("navbarToggle", handleCollapse as EventListener);
  }, []);

  return (
    <div className={styles.pageWrapper}>
      <Navbar />

      <main className={`${styles.contentArea} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.updatesContainer}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>Clinic Updates</h1>
            <p className={styles.subtitle}>
              Latest announcements from Our Skin Dermatology Center
            </p>
          </div>

          <div className={styles.layout}>
            {/* Main + Recent */}
            <div className={styles.leftSection}>
              <div className={styles.mainPost}>
                <iframe src={mainPost} className={styles.mainFrame} scrolling="no" frameBorder="0" />
              </div>

              <div className={styles.recentGrid}>
                {recentPosts.map((post, i) => (
                  <iframe key={i} src={post} className={styles.recentFrame} scrolling="no" frameBorder="0" />
                ))}
              </div>
            </div>

            {/* Featured */}
            <div className={styles.featuredSection}>
              <h3 className={styles.featuredTitle}>Featured Posts</h3>
              {featuredPosts.map((post, i) => (
                <iframe key={i} src={post} className={styles.featuredFrame} scrolling="no" frameBorder="0" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}