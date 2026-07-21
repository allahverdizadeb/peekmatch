/** Loading-state illustration for the CV Change Plan tab while the AI generation call is in
 * flight: a stylized CV sheet whose lines grow in like text being typed, hold, fade out, and loop,
 * plus a pulsing AI sparkle badge on the corner. */
export function GeneratingIllustration() {
  return (
    <div className="relative w-80 h-[254px] mx-auto">
      <div className="absolute inset-0 bg-white border border-border rounded-[14px] shadow-[0_1px_2px_rgba(16,42,67,.05)] px-[22px] py-5 flex flex-col">
        <div className="flex items-center gap-2.5">
          <div className="flex-none w-[30px] h-[30px] rounded-full bg-teal" />
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 w-[84px] rounded-[4px] origin-left bg-navy [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:0s]" />
            <div className="h-2 w-[54px] rounded-[4px] origin-left bg-muted [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:.22s]" />
          </div>
        </div>

        <div className="h-px my-4 flex-none bg-border" />

        <div className="flex flex-col gap-2.5">
          <div className="h-2 w-[250px] rounded-[4px] origin-left bg-border [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:.55s]" />
          <div className="h-2 w-[206px] rounded-[4px] origin-left bg-border [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:.85s]" />
          <div className="h-2 w-[236px] rounded-[4px] origin-left bg-border [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:1.15s]" />
          <div className="h-2 w-[150px] rounded-[4px] origin-left bg-teal [animation:pm-write-accent_5.6s_ease-in-out_infinite] [animation-delay:1.45s]" />
          <div className="h-2 w-[244px] rounded-[4px] origin-left bg-border [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:1.75s]" />
          <div className="h-2 w-[182px] rounded-[4px] origin-left bg-border [animation:pm-write_5.6s_ease-in-out_infinite] [animation-delay:2.05s]" />

          <div className="flex items-center mt-1.5 h-2">
            <div className="w-[2px] h-[11px] rounded-[1px] bg-teal [animation:pm-blink_1s_steps(2,start)_infinite]" />
          </div>
        </div>

        <div className="flex gap-1.5 mt-4">
          <div className="h-[18px] w-[46px] rounded-[8px] bg-success-bg [animation:pm-tagpop_5.6s_ease-in-out_infinite] [animation-delay:2.4s]" />
          <div className="h-[18px] w-[60px] rounded-[8px] bg-info-bg [animation:pm-tagpop_5.6s_ease-in-out_infinite] [animation-delay:2.55s]" />
          <div className="h-[18px] w-[50px] rounded-[8px] bg-premium-bg [animation:pm-tagpop_5.6s_ease-in-out_infinite] [animation-delay:2.7s]" />
        </div>
      </div>

      <div className="absolute -top-3 -right-3 w-[34px] h-[34px] rounded-full bg-white border border-border shadow-sh flex items-center justify-center">
        <svg
          className="w-[17px] h-[17px] origin-center [animation:pm-pulse_2.2s_ease-in-out_infinite]"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2.5c.4 3.6 1 5.9 2.1 7.4 1.1 1.5 3 2.3 5.9 2.6-2.9.3-4.8 1.1-5.9 2.6-1.1 1.5-1.7 3.8-2.1 7.4-.4-3.6-1-5.9-2.1-7.4-1.1-1.5-3-2.3-5.9-2.6 2.9-.3 4.8-1.1 5.9-2.6 1.1-1.5 1.7-3.8 2.1-7.4Z"
            fill="#0f9d91"
          />
        </svg>
      </div>
    </div>
  );
}
