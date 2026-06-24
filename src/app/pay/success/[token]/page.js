"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function SuccessPage() {
    const { token } = useParams();

    useEffect(() => {
        if (!token) return;

        fetch(`/api/invoices/by-token/${token}/pay`, {
            method: "POST",
        })
        .catch(err => console.error("Failed to update payment status:", err));

    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center text-center">
            <div>
                <h1 className="text-3xl font-bold text-green-600">
                    Payment Successful ✅
                </h1>
                <p className="mt-4">Your payment has been confirmed</p>
            </div>
        </div>
    );
}