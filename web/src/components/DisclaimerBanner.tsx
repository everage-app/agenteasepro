export function DisclaimerBanner() {
  return (
    <div className="border-t border-amber-500/20 bg-amber-500/10 text-amber-200 text-xs sm:text-sm backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col sm:flex-row gap-1 sm:gap-3 items-start sm:items-center">
        <span className="font-bold text-amber-400">Important:</span>
        <p className="leading-snug opacity-90">
          This tool helps you organize data for the official Utah REPC and related
          addendums. It is not legal advice. Always verify documents against the
          state-approved forms and consult a Utah real-estate attorney and your
          broker before using in a real transaction.
        </p>
      </div>
    </div>
  );
}
