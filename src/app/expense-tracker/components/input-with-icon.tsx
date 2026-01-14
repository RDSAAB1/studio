"use client";

import React from "react";

interface InputWithIconProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const InputWithIcon = ({ icon, children }: InputWithIconProps) => (
  <div className="relative">
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      {icon}
    </div>
    {children}
  </div>
);

