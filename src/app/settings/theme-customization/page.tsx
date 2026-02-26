"use client";

import React from 'react';

export default function ThemeCustomizationPage() {
    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold mb-2">
                Theme Customization
            </h1>
            <h2 className="text-xl text-muted-foreground mb-6">
                Customize the look and feel of the application
            </h2>
            <div className="p-6 border rounded-lg border-dashed flex items-center justify-center bg-muted/20 h-64">
                <p className="text-muted-foreground">Theme settings coming soon</p>
            </div>
        </div>
    );
}
