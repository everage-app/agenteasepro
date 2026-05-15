import { useEffect } from 'react';

export function AnimatedAppBackground() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const applyPointer = () => {
      frame = 0;
      if (!lastEvent) return;

      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const x = Math.min(100, Math.max(0, (lastEvent.clientX / width) * 100));
      const y = Math.min(100, Math.max(0, (lastEvent.clientY / height) * 100));
      const driftX = ((x - 50) / 50) * 14;
      const driftY = ((y - 50) / 50) * 10;

      document.documentElement.style.setProperty('--ae-pointer-x', `${x.toFixed(2)}%`);
      document.documentElement.style.setProperty('--ae-pointer-y', `${y.toFixed(2)}%`);
      document.documentElement.style.setProperty('--ae-pointer-drift-x', `${driftX.toFixed(2)}px`);
      document.documentElement.style.setProperty('--ae-pointer-drift-y', `${driftY.toFixed(2)}px`);
      document.documentElement.style.setProperty('--ae-pointer-drift-x-inverse', `${(-driftX).toFixed(2)}px`);
      document.documentElement.style.setProperty('--ae-pointer-drift-y-inverse', `${(-driftY).toFixed(2)}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!frame) frame = window.requestAnimationFrame(applyPointer);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="ae-bg-image" />
      <div className="ae-bg-reference-stage" />
      <svg className="ae-bg-reference-ribbon" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ae-ref-ribbon-main" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.17" stopColor="rgba(214,181,109,0.52)" />
            <stop offset="0.34" stopColor="rgba(245,235,205,0.55)" />
            <stop offset="0.52" stopColor="rgba(255,255,255,0.44)" />
            <stop offset="0.72" stopColor="rgba(176,180,188,0.46)" />
            <stop offset="0.90" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-ref-ribbon-shadow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(214,181,109,0)" />
            <stop offset="0.23" stopColor="rgba(214,181,109,0.28)" />
            <stop offset="0.48" stopColor="rgba(120,124,132,0.32)" />
            <stop offset="0.74" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-ref-ribbon-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.24" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="0.48" stopColor="rgba(214,181,109,0.38)" />
            <stop offset="0.74" stopColor="rgba(188,192,200,0.42)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-ref-thread-pearl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.20" stopColor="rgba(255,255,255,0.46)" />
            <stop offset="0.46" stopColor="rgba(184,188,196,0.36)" />
            <stop offset="0.70" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-ref-thread-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(214,181,109,0)" />
            <stop offset="0.22" stopColor="rgba(214,181,109,0.42)" />
            <stop offset="0.50" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="0.76" stopColor="rgba(159,121,51,0.30)" />
            <stop offset="1" stopColor="rgba(214,181,109,0)" />
          </linearGradient>
          <linearGradient id="ae-ref-thread-smoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(5,6,9,0)" />
            <stop offset="0.28" stopColor="rgba(5,6,9,0.26)" />
            <stop offset="0.55" stopColor="rgba(132,136,145,0.24)" />
            <stop offset="0.82" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-light-ribbon-main" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.16" stopColor="rgba(214,181,109,0.18)" />
            <stop offset="0.36" stopColor="rgba(255,255,255,0.52)" />
            <stop offset="0.56" stopColor="rgba(23,34,53,0.13)" />
            <stop offset="0.78" stopColor="rgba(214,181,109,0.16)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-light-ribbon-shadow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(23,34,53,0)" />
            <stop offset="0.24" stopColor="rgba(23,34,53,0.12)" />
            <stop offset="0.52" stopColor="rgba(100,116,139,0.10)" />
            <stop offset="0.78" stopColor="rgba(159,121,51,0.12)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-light-ribbon-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.22" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="0.48" stopColor="rgba(214,181,109,0.26)" />
            <stop offset="0.74" stopColor="rgba(23,34,53,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-light-thread-pearl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0)" />
            <stop offset="0.22" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="0.48" stopColor="rgba(23,34,53,0.16)" />
            <stop offset="0.74" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ae-light-thread-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(214,181,109,0)" />
            <stop offset="0.24" stopColor="rgba(214,181,109,0.30)" />
            <stop offset="0.52" stopColor="rgba(255,255,255,0.36)" />
            <stop offset="0.78" stopColor="rgba(159,121,51,0.16)" />
            <stop offset="1" stopColor="rgba(214,181,109,0)" />
          </linearGradient>
          <linearGradient id="ae-light-thread-smoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(23,34,53,0)" />
            <stop offset="0.28" stopColor="rgba(23,34,53,0.14)" />
            <stop offset="0.58" stopColor="rgba(100,116,139,0.12)" />
            <stop offset="0.84" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="ae-ref-soften" x="-6%" y="-20%" width="112%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <clipPath id="ae-ref-ribbon-clip">
            <path d="M -220 488 C 42 308 270 628 526 470 C 748 332 932 350 1164 484 C 1355 594 1515 540 1660 406 L 1660 560 C 1508 698 1325 718 1136 600 C 912 460 762 450 540 604 C 278 786 30 542 -220 652 Z" />
            <path d="M -220 572 C 42 438 278 724 548 590 C 784 472 944 488 1182 612 C 1368 708 1518 678 1660 540 L 1660 654 C 1515 786 1332 812 1148 720 C 918 604 788 595 560 708 C 300 838 44 635 -220 736 Z" />
            <path d="M -210 362 C 60 228 304 488 562 344 C 792 216 962 268 1196 388 C 1360 472 1510 418 1646 290 L 1646 388 C 1502 516 1340 542 1172 460 C 944 348 800 318 580 432 C 318 568 70 350 -210 474 Z" />
          </clipPath>
        </defs>
        <path className="ae-ref-fill ae-ref-fill-main" d="M -220 488 C 42 308 270 628 526 470 C 748 332 932 350 1164 484 C 1355 594 1515 540 1660 406 L 1660 560 C 1508 698 1325 718 1136 600 C 912 460 762 450 540 604 C 278 786 30 542 -220 652 Z" />
        <path className="ae-ref-fill ae-ref-fill-shadow" d="M -220 572 C 42 438 278 724 548 590 C 784 472 944 488 1182 612 C 1368 708 1518 678 1660 540 L 1660 654 C 1515 786 1332 812 1148 720 C 918 604 788 595 560 708 C 300 838 44 635 -220 736 Z" />
        <path className="ae-ref-fill ae-ref-fill-upper" d="M -210 362 C 60 228 304 488 562 344 C 792 216 962 268 1196 388 C 1360 472 1510 418 1646 290 L 1646 388 C 1502 516 1340 542 1172 460 C 944 348 800 318 580 432 C 318 568 70 350 -210 474 Z" />
        <g className="ae-ref-thread-group" clipPath="url(#ae-ref-ribbon-clip)">
          <path className="ae-ref-fold ae-ref-fold-shadow" d="M -190 548 C 68 396 296 668 540 532 C 780 398 944 438 1178 562 C 1365 662 1516 616 1662 474" />
          <path className="ae-ref-fold ae-ref-fold-glow" d="M -190 488 C 64 330 292 610 536 478 C 768 352 938 376 1164 506 C 1350 612 1510 560 1658 414" />
          <path className="ae-ref-thread ae-ref-thread-1" d="M -180 434 C 66 282 312 524 562 402 C 800 286 974 318 1204 430 C 1378 516 1518 470 1652 338" />
          <path className="ae-ref-thread ae-ref-thread-2" d="M -185 468 C 74 314 300 570 548 448 C 784 332 956 350 1188 474 C 1370 572 1514 522 1658 382" />
          <path className="ae-ref-thread ae-ref-thread-3" d="M -190 506 C 72 358 294 626 538 498 C 776 374 944 404 1178 524 C 1366 620 1510 580 1662 434" />
          <path className="ae-ref-thread ae-ref-thread-4" d="M -190 542 C 78 404 304 672 552 548 C 790 428 954 458 1186 572 C 1370 662 1518 630 1662 496" />
          <path className="ae-ref-thread ae-ref-thread-5" d="M -186 582 C 86 464 318 716 566 598 C 798 488 966 520 1198 622 C 1378 700 1520 672 1660 548" />
          <path className="ae-ref-thread ae-ref-thread-6" d="M -172 620 C 104 528 332 762 586 646 C 820 538 982 572 1214 668 C 1390 742 1526 724 1660 604" />
          <path className="ae-ref-thread ae-ref-thread-7" d="M -168 384 C 94 238 324 480 574 358 C 806 245 982 278 1218 392 C 1386 474 1520 420 1652 300" />
          <path className="ae-ref-thread ae-ref-thread-8" d="M -178 666 C 108 590 348 800 600 694 C 835 596 1002 632 1224 724 C 1400 798 1528 780 1660 658" />
        </g>
        <path className="ae-ref-stroke ae-ref-stroke-main" d="M -240 520 C 36 324 270 642 528 492 C 760 356 928 362 1162 500 C 1355 614 1512 558 1680 404" />
        <path className="ae-ref-stroke ae-ref-stroke-lower" d="M -230 624 C 50 484 292 748 560 620 C 800 505 952 520 1190 636 C 1380 730 1525 690 1680 548" />
        <path className="ae-ref-stroke ae-ref-stroke-upper" d="M -220 382 C 54 238 306 502 566 372 C 800 255 966 292 1196 408 C 1374 498 1518 438 1668 304" />
        <path className="ae-ref-stroke ae-ref-stroke-fine" d="M -220 450 C 60 290 290 560 538 438 C 768 325 956 330 1188 458 C 1378 562 1515 512 1660 370" />
      </svg>
      <div className="ae-bg-reference-sheen" />
      <div className="ae-bg-noise" />
      <div className="ae-bg-vignette" />
    </>
  );
}