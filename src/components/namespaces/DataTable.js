import React, { Component } from 'react';
import { Table, Badge } from 'reactstrap';
import ModalForm from './Modal';

const globalUrlPrefix = window.location.pathname;

class DataTable extends Component {
  deleteItem = (e, id) => {
    e.preventDefault();
    const confirmDelete = window.confirm('Delete namespace forever?');
    if (confirmDelete) {
      fetch(`${globalUrlPrefix}admin/namespaces`, {
        method: 'delete',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          id,
        }),
      })
        .then((response) => response.json())
        .then(() => {
          this.props.deleteItemFromState(id);
        })
        .catch((err) => console.log(err));
    }
  }

  itemName = (name) => {
    if (name === '') {
      return '__default__';
    }
    return name;
  }

  personalDescription = (item) => {
    let text = item.personal ? '✅' : '';
    if (item.personal && item.personal_single_connection) {
      text += ' (+ single conn)';
    }
    return text;
  }

  itemDescription = (item) => {
    return (
      <div className="collapsed">
        <p>
          <Badge color={item.history_size > 0 ? 'success' : 'secondary'}>
            History size:
            {' '}
            {item.history_size ? item.history_size : 0}
          </Badge>
          {' '}
          <Badge color={item.history_ttl !== '0s' ? 'success' : 'secondary'}>
            History TTL:
            {' '}
            {item.history_ttl ? item.history_ttl : '0'}
          </Badge>
          {' '}
          <Badge color={item.history_disable_for_client ? 'success' : 'secondary'}>
            History disabled for client:
            {' '}
            {item.history_disable_for_client ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.position ? 'success' : 'secondary'}>
            Position:
            {' '}
            {item.position ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.recover ? 'success' : 'secondary'}>
            Recover:
            {' '}
            {item.recover ? 'yes' : 'no'}
          </Badge>
        </p>
        <p>
          <Badge color={item.presence ? 'success' : 'secondary'}>
            Presence:
            {' '}
            {item.presence ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.presence_disable_for_client ? 'success' : 'secondary'}>
            Presence disabled for client:
            {' '}
            {item.presence_disable_for_client ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.join_leave ? 'success' : 'secondary'}>
            Join/Leave:
            {' '}
            {item.join_leave ? 'yes' : 'no'}
          </Badge>
        </p>
        <p>
          <Badge color={item.protected ? 'success' : 'secondary'}>
            Protected:
            {' '}
            {item.protected ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.anonymous ? 'success' : 'secondary'}>
            Anonymous:
            {' '}
            {item.anonymous ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.publish ? 'success' : 'secondary'}>
            Publish:
            {' '}
            {item.publish ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.subscribe_to_publish ? 'success' : 'secondary'}>
            Subscribe to publish:
            {' '}
            {item.subscribe_to_publish ? 'yes' : 'no'}
          </Badge>
        </p>
        <p>
          <Badge color={item.proxy_subscribe ? 'success' : 'secondary'}>
            Proxy subscribe:
            {' '}
            {item.proxy_subscribe ? 'yes' : 'no'}
          </Badge>
          {' '}
          <Badge color={item.proxy_publish ? 'success' : 'secondary'}>
            Proxy publish:
            {' '}
            {item.proxy_publish ? 'yes' : 'no'}
          </Badge>
        </p>
      </div>
    );
  }

  render() {
    const items = this.props.items.map((item) => {
      let delButton;
      if (item.name !== '') {
        delButton = <a href="#" color="danger" onClick={(e) => this.deleteItem(e, item.id)}>Delete</a>;
      }
      return (
        <tr key={item.id}>
          <td>{this.itemName(item.name)}</td>
          <td>{this.itemDescription(item)}</td>
          <td>{this.personalDescription(item)}</td>
          <td>
            <ModalForm buttonLabel="Edit" item={item} updateState={this.props.updateState} />
            {delButton}
          </td>
        </tr>
      );
    });

    return (
      <Table responsive hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Options</th>
            <th>Personal</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items}
        </tbody>
      </Table>
    );
  }
}

export default DataTable;
