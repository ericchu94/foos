import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

// Apollo
import { split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';
import { ApolloClient } from 'apollo-client';
import { ApolloProvider, useSubscription } from '@apollo/react-hooks';
import { useQuery, useMutation } from '@apollo/react-hooks';
import { gql } from 'apollo-boost';
import { InMemoryCache } from 'apollo-cache-inmemory';

// Create an http link:
const httpLink = new HttpLink({
    uri: 'http://localhost:8080/graphql'
});

// Create a WebSocket link:
const wsLink = new WebSocketLink({
    uri: `ws://localhost:8080/graphql`,
    options: {
        reconnect: true
    }
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
    // split based on operation type
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
        );
    },
    wsLink,
    httpLink,
);

const cache = new InMemoryCache();

const client = new ApolloClient({link, cache});

function SidePlayer(props) {
    return (
        <div className="player">{props.player.name}</div>
    )
}

function Side(props) {
    const id = props.side.id;
    const color = props.color;
    
    const className = 'side ' + color;


    const { data, loading, error } = useSubscription(gql`
        subscription side($id: ID!) {
            side(id: $id) {
                id
                points
            }
        }
    `,
        { variables: { id } }
    );

    if (error)
        console.log(error);

    const side = (!loading && data.side.id === id) ? data.side : props.side;
    console.log(side);

    return (
        <div className={className}>
            {side.points}
            {/*side.players.map(player => (
                <SidePlayer key={player.name} player={player} />
            ))*/}
        </div>
    );
}

function Game(props) {

    const className = 'game' + (props.game.swapped ? ' swapped' : '');

    const [updateSide, updatePayload] = useMutation(gql`
        mutation updateSide($id: ID!, $points: Int!) {
            updateSide(input: {id: $id, fields: {points: $points}}) {
                error {
                    code
                    message
                }
                result {
                    id
                    points
                }
            }
        }
    `);

    const updatePayloadData = updatePayload.data;
    if (updatePayloadData) {
        const side = updatePayloadData.updateSide.result;
        const yellow = props.game.yellow;
        const black = props.game.black;
        if (side.id === yellow.id) {
            yellow.points = side.points;
        }
        if (side.id === black.id) {
            black.points = side.points;
        }
    }

    return (
        <div className={className}>
            <div className="gameNum">{props.num}</div>
            <Side allPlayers={props.allPlayers} color="yellow" side={props.game.yellow} />
            <Side allPlayers={props.allPlayers} color="black" side={props.game.black} />
            <div className="scoreControl">
                <div>
                    Top
                    <button onClick={e => updateSide({variables: {id: props.game.yellow.id, points: props.game.yellow.points + 1}})}>+</button>
                    <button onClick={e => updateSide({variables: {id: props.game.yellow.id, points: props.game.yellow.points - 1}})}>-</button>
                </div>
                <div>
                    Bot
                    <button onClick={e => updateSide({variables: {id: props.game.black.id, points: props.game.black.points + 1}})}>+</button>
                    <button onClick={e => updateSide({variables: {id: props.game.black.id, points: props.game.black.points - 1}})}>-</button>
                </div>
            </div>
        </div>
    );
}

function Games(props) {
    const games = props.games;
    const matchId = props.matchId;

    const { data, loading, error } = useSubscription(gql`
        subscription matchGames($matchId: ID!) {
            matchGames(matchId: $matchId) {
                id
                name
                swapped
                yellow {
                    id
                    points
                }
                black {
                    id
                    points
                }
            }
        }
    `,
        { variables: { matchId } }
    );

    if (error) {
        console.log(error);
    }

    if (!loading) {
        const game = data.matchGames;
        const old = games.filter(x => x.id === game.id)[0];
        if (old === undefined) {
            games.push(game);
        } else {
            Object.assign(old, game);
        }
    }

    const [del, delPayload] = useMutation(gql`
        mutation deleteGame($id: ID!) {
            deleteGame(input: {id: $id}) {
                error {
                    code
                    message
                }
                result {
                    id
                    name
                }
            }
        }
    `);

    const delPayloadData = delPayload.data;
    if (delPayloadData) {
        const game = delPayloadData.deleteGame.result;
        const index = games.map(x => x.id).indexOf(game.id);
        if (index > -1)
            games.splice(index, 1);
    }

    return (
        <React.Fragment>
            {games.map((game, i) => (
                <React.Fragment key={game.id}>
                    <button className="deleteGame" onClick={e => {
                        del({ variables: {id: game.id}});
                    }}>-</button>
                    <Game num={i + 1} allPlayers={props.allPlayers} top={props.top} key={game.id} game={game} />
                </React.Fragment>
            ))}
        </React.Fragment>
    );
}

function Match(props) {
    const match = props.match;
    const matchId = match.id;
    const games = match.games;

    const [addPlayer, setAddPlayer] = useState('');

    const [addPlayerMatch] = useMutation(gql`
        mutation addPlayerMatch($id: ID!, $matchId: ID!, $spot: Spot!) {
            addPlayerMatch(input: {playerId: $id, matchId: $matchId, spot: $spot}) {
                error {
                    code
                    message
                }
                result
            }
        }
    `);


    const [gameName, setGameName] = useState('');
    const [swapped, setSwapped] = useState(false);

    const [createGame, createGamePayload] = useMutation(gql`
        mutation createGame($matchId: ID!, $name: String!, $swapped: Boolean!) {
            createGame(input: {matchId: $matchId, name: $name, swapped: $swapped}) {
                error {
                    code
                    message
                }
                result {
                    id
                    name
                    swapped
                    yellow {
                        id
                        points
                    }
                    black {
                        id
                        points
                    }
                }
            }
        }
    `);
    const createGamePayloadData = createGamePayload.data;
    if (createGamePayloadData) {
        const game = createGamePayloadData.createGame.result;
        console.log(game);
        if (games.filter(x => x.id === game.id).length === 0)
            games.push(game);
    }

    return (
        <div className="match">
            <div>
                {match.name}
            </div>
            <div className="scoreBox">
                <div>
                    <div className="dummy">&nbsp;</div>
                    <div className="playerName yellow">
                        {match.top.map(player => (
                            <span key={player.id}>{player.name}</span>
                        ))}
                    </div>
                    <div className="playerName black">
                        {match.bottom.map(player => (
                            <span key={player.id}>{player.name}</span>
                        ))}
                    </div>
                </div>
                <Games allPlayers={props.allPlayers} top={match.top} matchId={match.id} games={games} />
            </div>

            <div className="createGame">
                {/*<input type="text" onChange={e => setGameName(e.target.value)} />*/}
                swapped: <input type="checkbox" onChange={e => {
                    setSwapped(e.target.checked)}
                } />
                <button onClick={e => createGame({variables: {matchId, name: gameName, swapped: swapped}})}>create game</button>
            </div>
            
            <div>
                <select onChange={e => setAddPlayer(e.target.value)}>
                    <option disabled selected value>Player</option>
                    {props.allPlayers.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                </select>
                <button onClick={e => addPlayerMatch({variables: {id: addPlayer, matchId: match.id, spot: 'TOP'}})}>Add top player</button>
                <button onClick={e => addPlayerMatch({variables: {id: addPlayer, matchId: match.id, spot: 'BOTTOM'}})}>Add bottom player</button>
            </div>
        </div>
    );
}

function Matches(props) {
    const matches = props.matches

    const { data, loading, error } = useSubscription(gql`
        subscription match {
            match {
                id
                name
            }
        }
    `);

    if (error) {
        console.log(error);
    }

    if (!loading) {
        const match = data.match;
        const old = matches.filter(x => x.id === match.id)[0];
        if (old === undefined) {
            console.log('add');
            matches.push(match);
        } else {
            console.log('update');
            Object.assign(old, match);
        }
    }

    return matches.map(match => (
        <Match allPlayers={props.allPlayers} key={match.id} match={match} />
    ));
}

function Players(props) {
    const players = props.players;

    const [deletePlayer, delPayload] = useMutation(gql`
        mutation deletePlayer($id: ID!) {
            deletePlayer(input: {playerId: $id}) {
                error {
                    code
                    message
                }
                result {
                    id
                    name
                }
            }
        }
    `);
    const delData = delPayload.data;
    if (delData) {
        const player = delData.deletePlayer.result;
        const index = players.map(x => x.id).indexOf(player.id);
        console.log(players, player, index)
        if (index > -1)
            players.splice(index, 1);
    }

    const [createPlayer, createPlayerPayload] = useMutation(gql`
        mutation createPlayer($name: String!) {
            createPlayer(input: {name: $name}) {
                error {
                    code
                    message
                }
                result {
                    id
                    name
                }
            }
        }
    `);
    const createPlayerPayloadData = createPlayerPayload.data;
    if (createPlayerPayloadData) {
        const player = createPlayerPayloadData.createPlayer.result;
        if (players.filter(x => x.id === player.id).length === 0)
            players.push(player);
    }

    const [playerName, setPlayerName] = useState('');

    return (
        <div className="players">
            {players.map(player => (
                <div key={player.id} className="player">
                    {player.name} <button onClick={e => {
                        deletePlayer({variables: {id: player.id}});
                    }}>delete</button>
                </div>
            ))}
            <input type="text" onChange={e => {
                setPlayerName(e.target.value);
            }} />
            <button onClick={e => {
                createPlayer({variables: {name: playerName}});
            }}>create player</button>
        </div>
    );
}

function App() {
    const { loading, error, data } = useQuery(gql`
        {
            matches {
                id  
                name
                top {
                    id
                    name
                }
                bottom {
                    id
                    name
                }
                games {
                    id
                    name
                    swapped
                    yellow {
                        id
                        points
                    }
                    black {
                        id
                        points
                    }
                }
            }
            players {
                id
                name
            }
        }
    `);

    if (loading) return 'Loading...';
    if (error) return `Error! ${error.message}`;

    return (
        <div>
            <Matches allPlayers={data.players} matches={data.matches.reverse()} />
            <Players players={data.players} />
        </div>
    );
}

// ========================================

ReactDOM.render(
    <ApolloProvider client={client}>
        <App />
    </ApolloProvider>,
    document.getElementById('root')
);
