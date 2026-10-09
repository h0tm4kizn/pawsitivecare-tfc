import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles = null;
let savedScrollbarWidth = 0;

export default function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      savedScrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
      body.setAttribute('data-scroll-lock-owner', 'hook');
      savedStyles = {
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyPaddingRight: body.style.paddingRight,
        bodyTouchAction: body.style.touchAction,
        bodyOverscroll: body.style.overscrollBehavior,
        htmlOverflow: html.style.overflow,
        htmlOverscroll: html.style.overscrollBehavior,
      };

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      if (savedScrollbarWidth > 0) {
        body.style.paddingRight = `${savedScrollbarWidth}px`;
      }
      body.style.touchAction = 'none';
      body.style.overscrollBehavior = 'none';
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;
      if (!savedStyles) return;

      body.style.overflow = savedStyles.bodyOverflow;
      body.style.position = savedStyles.bodyPosition;
      body.style.top = savedStyles.bodyTop;
      body.style.left = savedStyles.bodyLeft;
      body.style.right = savedStyles.bodyRight;
      body.style.width = savedStyles.bodyWidth;
      body.style.paddingRight = savedStyles.bodyPaddingRight;
      body.style.touchAction = savedStyles.bodyTouchAction;
      body.style.overscrollBehavior = savedStyles.bodyOverscroll;
      html.style.overflow = savedStyles.htmlOverflow;
      html.style.overscrollBehavior = savedStyles.htmlOverscroll;
      // Restore the previous scroll position without visible jump.
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
      savedStyles = null;
      savedScrollbarWidth = 0;
      body.removeAttribute('data-scroll-lock-owner');
    };
  }, [isLocked]);
}
