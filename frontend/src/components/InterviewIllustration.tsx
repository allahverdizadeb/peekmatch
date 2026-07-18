/** Loading-state illustration for the Workspace "Müsahibə hazırlığı" (Interview Preparation) tab
 * while the AI generation call is in flight: a vertical chat transcript between an HR interviewer
 * (left, navy avatar, gray bubbles) and the candidate (right, teal avatar, teal-tinted bubbles).
 * Bubbles arrive bottom-up one at a time in a staggered, continuously restarting loop, their text
 * lines "typing" in via the same grow/hold/fade rhythm as the sibling CV illustration, and the
 * final candidate bubble shows a pulsing three-dot typing indicator before the loop restarts. */
export function InterviewIllustration() {
  return (
    <div className="relative w-full max-w-[416px] mx-auto">
      <div className="h-[260px] flex flex-col justify-end gap-3.5 overflow-hidden px-0.5 py-1">
        {/* HR message 1 */}
        <div className="flex items-end gap-2.5 justify-start opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:0s]">
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-navy" />
          <div className="flex flex-col gap-1.5 max-w-[226px] px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] bg-bg2">
            <div
              className="h-2 rounded-[4px] origin-left bg-muted/55 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:0s]"
              style={{ width: 150 }}
            />
            <div
              className="h-2 rounded-[4px] origin-left bg-muted/55 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:.12s]"
              style={{ width: 96 }}
            />
          </div>
        </div>

        {/* Candidate message 1 */}
        <div className="flex items-end gap-2.5 justify-end opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:1.05s]">
          <div className="flex flex-col gap-1.5 max-w-[226px] px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-bl-[14px] rounded-br-[4px] bg-teal/[0.13]">
            <div
              className="h-2 rounded-[4px] origin-right ml-auto bg-teal/70 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:1.05s]"
              style={{ width: 132 }}
            />
          </div>
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-teal" />
        </div>

        {/* HR message 2 */}
        <div className="flex items-end gap-2.5 justify-start opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:2.1s]">
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-navy" />
          <div className="flex flex-col gap-1.5 max-w-[226px] px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] bg-bg2">
            <div
              className="h-2 rounded-[4px] origin-left bg-muted/55 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:2.1s]"
              style={{ width: 172 }}
            />
            <div
              className="h-2 rounded-[4px] origin-left bg-muted/55 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:2.22s]"
              style={{ width: 110 }}
            />
          </div>
        </div>

        {/* Candidate message 2 */}
        <div className="flex items-end gap-2.5 justify-end opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:3.15s]">
          <div className="flex flex-col gap-1.5 max-w-[226px] px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-bl-[14px] rounded-br-[4px] bg-teal/[0.13]">
            <div
              className="h-2 rounded-[4px] origin-right ml-auto bg-teal/70 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:3.15s]"
              style={{ width: 168 }}
            />
            <div
              className="h-2 rounded-[4px] origin-right ml-auto bg-teal/70 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:3.27s]"
              style={{ width: 84 }}
            />
          </div>
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-teal" />
        </div>

        {/* HR message 3 */}
        <div className="flex items-end gap-2.5 justify-start opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:4.2s]">
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-navy" />
          <div className="flex flex-col gap-1.5 max-w-[226px] px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] bg-bg2">
            <div
              className="h-2 rounded-[4px] origin-left bg-muted/55 [animation:pm-write_6.4s_ease-in-out_infinite] [animation-delay:4.2s]"
              style={{ width: 140 }}
            />
          </div>
        </div>

        {/* Candidate message 3 — typing indicator, as if still being drafted */}
        <div className="flex items-end gap-2.5 justify-end opacity-0 [animation:pm-msg-in_6.4s_ease-in-out_infinite] [animation-delay:5.25s]">
          <div className="flex items-center gap-1 h-2 px-[13px] py-2.5 rounded-tl-[14px] rounded-tr-[14px] rounded-bl-[14px] rounded-br-[4px] bg-teal/[0.13] text-teal">
            <span className="w-[5px] h-[5px] rounded-full bg-current opacity-35 [animation:pm-dot_1.1s_ease-in-out_infinite] [animation-delay:0s]" />
            <span className="w-[5px] h-[5px] rounded-full bg-current opacity-35 [animation:pm-dot_1.1s_ease-in-out_infinite] [animation-delay:.15s]" />
            <span className="w-[5px] h-[5px] rounded-full bg-current opacity-35 [animation:pm-dot_1.1s_ease-in-out_infinite] [animation-delay:.3s]" />
          </div>
          <div className="flex-none w-[26px] h-[26px] rounded-full bg-teal" />
        </div>
      </div>

      <div className="absolute -top-3 -right-3 w-[34px] h-[34px] rounded-full bg-white border border-border shadow-sh flex items-center justify-center">
        <svg
          className="w-4 h-4 origin-center [animation:pm-pulse_2.2s_ease-in-out_infinite]"
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
