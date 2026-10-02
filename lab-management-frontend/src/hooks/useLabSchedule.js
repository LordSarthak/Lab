import { useEffect, useState } from 'react';
import api from '../api';

const useLabSchedule = () => {
    const [labs, setLabs] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let isCurrent = true;
        setLoading(true);
        setError(null);
        Promise.all([api.get('/labs'), api.get('/bookings')])
            .then(([labResponse, bookingResponse]) => {
                if (!isCurrent) return;
                setLabs(labResponse.data);
                setBookings(bookingResponse.data);
            })
            .catch((requestError) => { if (isCurrent) setError(requestError); })
            .finally(() => { if (isCurrent) setLoading(false); });
        return () => { isCurrent = false; };
    }, [reload]);

    const retry = () => setReload((current) => current + 1);

    return { labs, bookings, loading, error, retry };
};

export default useLabSchedule;