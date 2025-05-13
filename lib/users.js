const { db } = require('./db');

async function createUser(userId, email, password, firstName, lastName) {
    const userData = {
        userId,
        email,
        password,
        firstName,
        lastName,
        projects: []
    };
    await db.collection('users').doc(userId).set(userData);
    console.log('User created successfully');
}

async function searchUsers(searchQuery) {
    try {
        const usersRef = db.collection('users');
        // Cari user berdasarkan email atau nama
        const emailResults = await usersRef
            .where('email', '>=', searchQuery)
            .where('email', '<=', searchQuery + '\uf8ff')
            .get();
            
        const firstNameResults = await usersRef
            .where('firstName', '>=', searchQuery)
            .where('firstName', '<=', searchQuery + '\uf8ff')
            .get();

        const lastNameResults = await usersRef
            .where('lastName', '>=', searchQuery)
            .where('lastName', '<=', searchQuery + '\uf8ff')
            .get();

        // Gabungkan hasil pencarian dan hilangkan duplikat
        const userMap = new Map();
        
        [emailResults, firstNameResults, lastNameResults].forEach(snapshot => {
            snapshot.forEach(doc => {
                if (!userMap.has(doc.id)) {
                    userMap.set(doc.id, {
                        userId: doc.id,
                        ...doc.data()
                    });
                }
            });
        });

        return Array.from(userMap.values());
    } catch (error) {
        console.error('Error searching users:', error);
        throw error;
    }
}

module.exports = {
    createUser,
    searchUsers
}