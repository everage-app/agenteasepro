import React from "react";

type AppPageProps = {
  children: React.ReactNode;
};

export function AppPage({ children }: AppPageProps) {
  return (
    <div className="w-full">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:px-6 lg:pb-14">
        {children}
      </div>
    </div>
  );
}
