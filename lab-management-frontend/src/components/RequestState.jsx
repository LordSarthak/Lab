import React from "react";
import { AlertCircle, LoaderCircle, RotateCw } from "lucide-react";

export const getRequestErrorMessage = (error) => {
    if (error?.code === "ERR_NETWORK") {
        return "The lab server cannot be reached at localhost:5000. Start the backend and retry.";
    }

    return error?.response?.data?.message || error?.message || "The request could not be completed.";
};

const RequestState = ({ loading, error, onRetry, loadingMessage = "Loading records..." }) => {
    if (loading) {
        return (
            <div className="request-state" role="status">
                <LoaderCircle className="request-spinner" size={19} aria-hidden="true" />
                <p>{loadingMessage}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="request-state error" role="alert">
                <AlertCircle size={19} aria-hidden="true" />
                <p>{typeof error === "string" ? error : getRequestErrorMessage(error)}</p>
                {onRetry && (
                    <button type="button" onClick={onRetry}>
                        <RotateCw size={15} aria-hidden="true" /> Retry
                    </button>
                )}
            </div>
        );
    }

    return null;
};

export default RequestState;